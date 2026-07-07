import json

from django.db.models import Prefetch
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Conversation, Message, MessageFeedback
from .serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    CreateFeedbackSerializer,
    CreateMessageSerializer,
    MessageFeedbackSerializer,
    MessageSerializer,
)
from .throttling import (
    ChatBurstRateThrottle,
    ChatSustainedRateThrottle,
    LocalizedThrottledMixin,
)


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
        return (
            Conversation.objects.filter(user=self.request.user)
            .prefetch_related(
                Prefetch(
                    "messages", queryset=Message.objects.select_related("feedback")
                )
            )
        )


def _get_conversation(user, pk) -> Conversation:
    return get_object_or_404(Conversation, pk=pk, user=user)


def _history_payload(conversation) -> list[dict]:
    return [
        {"role": m.role, "content": m.content}
        for m in conversation.messages.all()
    ]


class MessageCreateView(LocalizedThrottledMixin, APIView):
    """Persist a user message, call the AI, persist + return the assistant reply (JSON).

    The response carries the structured grounding as `sources` (B1):
    `[{slug, title, source_url}]`, empty when the answer is ungrounded.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ChatBurstRateThrottle, ChatSustainedRateThrottle]

    def post(self, request, pk):
        conversation = _get_conversation(request.user, pk)
        serializer = CreateMessageSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = serializer.validated_data.get("language") or conversation.language

        user_msg = Message.objects.create(
            conversation=conversation, role=Message.USER, content=content
        )
        conversation.ensure_title(content)

        reply = services.generate_reply(_history_payload(conversation), language)
        assistant_msg = Message.objects.create(
            conversation=conversation,
            role=Message.ASSISTANT,
            content=reply["content"],
            model=reply.get("model", ""),
            tokens=reply.get("tokens"),
        )
        conversation.save(update_fields=["updated_at"])

        return Response(
            {
                "user_message": MessageSerializer(user_msg).data,
                "assistant_message": MessageSerializer(assistant_msg).data,
                "sources": reply.get("sources", []),
            },
            status=status.HTTP_201_CREATED,
        )


class MessageStreamView(LocalizedThrottledMixin, APIView):
    """Same as MessageCreateView but streams the assistant reply via Server-Sent Events.

    SSE protocol:
      event: meta    -> {"user_message_id": ...}
      event: sources -> [{"slug": ..., "title": ..., "source_url": ...}]  (B1; may be [])
      data: {"delta": "..."}        (repeated)
      event: done    -> {"assistant_message_id": ..., "content": "..."}
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ChatBurstRateThrottle, ChatSustainedRateThrottle]

    def post(self, request, pk):
        conversation = _get_conversation(request.user, pk)
        serializer = CreateMessageSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = serializer.validated_data.get("language") or conversation.language

        user_msg = Message.objects.create(
            conversation=conversation, role=Message.USER, content=content
        )
        conversation.ensure_title(content)
        history = _history_payload(conversation)

        def event_stream():
            yield _sse("meta", {"user_message_id": user_msg.id})
            chunks, sources = services.stream_reply(history, language)
            yield _sse("sources", sources)
            parts: list[str] = []
            for chunk in chunks:
                parts.append(chunk)
                yield _sse_data({"delta": chunk})
            full = "".join(parts)
            assistant_msg = Message.objects.create(
                conversation=conversation,
                role=Message.ASSISTANT,
                content=full,
                model=services.settings.OPENAI_MODEL if not services.is_mock_mode() else "mock",
            )
            conversation.save(update_fields=["updated_at"])
            yield _sse("done", {"assistant_message_id": assistant_msg.id, "content": full})

        response = StreamingHttpResponse(
            event_stream(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class MessageFeedbackView(APIView):
    """Idempotent 👍/👎 upsert on one assistant message (A2). Owner-only."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        message = get_object_or_404(
            Message,
            pk=pk,
            conversation__user=request.user,
            role=Message.ASSISTANT,
        )
        serializer = CreateFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feedback, created = MessageFeedback.objects.update_or_create(
            message=message, defaults=serializer.validated_data
        )
        return Response(
            MessageFeedbackSerializer(feedback).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


def _sse_data(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse(event: str, payload) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
