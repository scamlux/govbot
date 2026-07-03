import json

from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import Throttled
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Conversation, Message, MessageFeedback
from .serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    CreateMessageSerializer,
    MessageFeedbackSerializer,
    MessageSerializer,
)
from .throttles import ChatBurstThrottle, ChatSustainedThrottle

# A1 — localized text shown when a user hits the chat rate limit (429).
THROTTLE_MESSAGE = {
    "uz": "Juda ko'p so'rov yuborildi. Iltimos, biroz kutib, qayta urinib ko'ring.",
    "ru": "Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.",
    "en": "Too many requests. Please wait a moment and try again.",
}


class ConversationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return ConversationListSerializer

    def get_queryset(self):
        return (
            Conversation.objects.filter(user=self.request.user)
            .prefetch_related("messages")
        )

    def perform_create(self, serializer):
        language = self.request.data.get("language", self.request.user.preferred_language)
        if language not in ("uz", "ru", "en"):
            language = "uz"
        serializer.save(user=self.request.user, language=language)


class ConversationDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationDetailSerializer

    def get_queryset(self):
        # Prefetch the reverse OneToOne feedback too: MessageSerializer nests it, so without
        # this each message would trigger its own query (N+1) on conversation detail.
        return (
            Conversation.objects.filter(user=self.request.user)
            .prefetch_related("messages__feedback")
        )


def _get_conversation(user, pk) -> Conversation:
    return get_object_or_404(Conversation, pk=pk, user=user)


def _history_payload(conversation) -> list[dict]:
    return [
        {"role": m.role, "content": m.content}
        for m in conversation.messages.all()
    ]


class _ThrottledChatView(APIView):
    """Base for the chat message endpoints: auth + per-user rate limiting (A1).

    A burst (per-minute) and a sustained (per-day) throttle are applied together so a
    single account can neither hammer nor drain the OpenAI budget. On a 429 we replace
    DRF's English default with a message localized to the request language.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ChatBurstThrottle, ChatSustainedThrottle]

    def throttled(self, request, wait):
        language = request.data.get("language")
        if language not in THROTTLE_MESSAGE:
            language = "uz"
        raise Throttled(wait=wait, detail=THROTTLE_MESSAGE[language])


class MessageCreateView(_ThrottledChatView):
    """Persist a user message, call the AI, persist + return the assistant reply (JSON)."""

    def post(self, request, pk):
        conversation = _get_conversation(request.user, pk)
        serializer = CreateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = serializer.validated_data.get("language") or conversation.language

        user_msg = Message.objects.create(
            conversation=conversation, role=Message.USER, content=content
        )
        conversation.ensure_title(content)

        history = _history_payload(conversation)
        # B1 — retrieve grounding once, reuse for the prompt and for the response sources.
        snippets = services.retrieve_snippets(history, language)
        reply = services.generate_reply(history, language, snippets=snippets)
        sources = reply.get("sources") or []
        assistant_msg = Message.objects.create(
            conversation=conversation,
            role=Message.ASSISTANT,
            content=reply["content"],
            model=reply.get("model", ""),
            tokens=reply.get("tokens"),
            sources=sources or None,  # B3 — persist citations; None when ungrounded
        )
        conversation.save(update_fields=["updated_at"])

        return Response(
            {
                "user_message": MessageSerializer(user_msg).data,
                "assistant_message": MessageSerializer(assistant_msg).data,
                "sources": sources,
            },
            status=status.HTTP_201_CREATED,
        )


class MessageStreamView(_ThrottledChatView):
    """Same as MessageCreateView but streams the assistant reply via Server-Sent Events.

    SSE protocol:
      event: meta     -> {"user_message_id": ...}
      data: {"delta": "..."}        (repeated)
      event: sources  -> {"sources": [{slug, title, source_url}]}   (B1, before done)
      event: done     -> {"assistant_message_id": ..., "content": "..."}
    """

    def post(self, request, pk):
        conversation = _get_conversation(request.user, pk)
        serializer = CreateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = serializer.validated_data.get("language") or conversation.language

        user_msg = Message.objects.create(
            conversation=conversation, role=Message.USER, content=content
        )
        conversation.ensure_title(content)
        history = _history_payload(conversation)
        # B1 — retrieve grounding once, before streaming, so we can both ground the prompt
        # and emit the sources frame.
        snippets = services.retrieve_snippets(history, language)
        sources = services.sources_from_snippets(snippets)

        def event_stream():
            yield _sse("meta", {"user_message_id": user_msg.id})
            parts: list[str] = []
            for chunk in services.stream_reply(history, language, snippets=snippets):
                parts.append(chunk)
                yield _sse_data({"delta": chunk})
            full = "".join(parts)
            assistant_msg = Message.objects.create(
                conversation=conversation,
                role=Message.ASSISTANT,
                content=full,
                model=services.settings.OPENAI_MODEL if not services.is_mock_mode() else "mock",
                sources=sources or None,  # B3
            )
            conversation.save(update_fields=["updated_at"])
            if sources:
                yield _sse("sources", {"sources": sources})
            yield _sse("done", {"assistant_message_id": assistant_msg.id, "content": full})

        response = StreamingHttpResponse(
            event_stream(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class MessageFeedbackView(APIView):
    """Upsert the current user's 👍/👎 rating of an assistant message (A2).

    Only the message's owner may rate it, and only assistant messages are rateable.
    Idempotent: re-posting updates the existing rating/reason.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        message = get_object_or_404(
            Message.objects.select_related("conversation"),
            pk=pk,
            conversation__user=request.user,
            role=Message.ASSISTANT,
        )
        serializer = MessageFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback, _created = MessageFeedback.objects.update_or_create(
            message=message,
            defaults={
                "rating": serializer.validated_data["rating"],
                "reason": serializer.validated_data.get("reason", ""),
            },
        )
        return Response(
            MessageFeedbackSerializer(feedback).data, status=status.HTTP_200_OK
        )


def _sse_data(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
