import json

from django.conf import settings
from django.db.models import Count
from django.http import Http404, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import retrieval, safety, services
from .models import Conversation, Message, MessageFeedback
from .serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    CreateMessageSerializer,
    GuestMessageSerializer,
    MessageFeedbackSerializer,
    MessageSerializer,
)
from .throttles import (
    ChatBurstThrottle,
    ChatSustainedThrottle,
    GuestBurstThrottle,
    GuestSustainedThrottle,
)


def reply_language(content: str, requested: str) -> str:
    """A7 — answer in the question's language when detected confidently (if enabled)."""
    if getattr(settings, "CHAT_AUTODETECT_LANGUAGE", True):
        return safety.resolve_reply_language(content, requested)
    return requested

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
        # Annotate the count in SQL rather than prefetching every message just to call
        # .count() per row (an N+1 COUNT). The list view never serializes message bodies.
        return (
            Conversation.objects.filter(user=self.request.user)
            .annotate(message_count=Count("messages"))
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
        serializer = CreateMessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = reply_language(
            content, serializer.validated_data.get("language") or conversation.language
        )
        plain = serializer.validated_data.get("plain", False)

        user_msg = Message.objects.create(
            conversation=conversation, role=Message.USER, content=content
        )
        conversation.ensure_title(content)

        history = _history_payload(conversation)
        # B1 — retrieve grounding once, reuse for the prompt and for the response sources.
        snippets = services.retrieve_snippets(history, language)
        reply = services.generate_reply(history, language, snippets=snippets, plain=plain)
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
                "language": language,
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
        serializer = CreateMessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = reply_language(
            content, serializer.validated_data.get("language") or conversation.language
        )
        plain = serializer.validated_data.get("plain", False)

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
            yield _sse("meta", {"user_message_id": user_msg.id, "language": language})
            parts: list[str] = []
            for chunk in services.stream_reply(
                history, language, snippets=snippets, plain=plain
            ):
                parts.append(chunk)
                yield _sse_data({"delta": chunk})
            full = "".join(parts)
            assistant_msg = Message.objects.create(
                conversation=conversation,
                role=Message.ASSISTANT,
                content=full,
                model=services.reply_model_label(),
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


class RelatedQuestionsView(APIView):
    """Up to 3 catalog questions related to a message — shown after an assistant reply.

    ``GET /api/chat/related/?message=...&lang=uz&exclude=<slug>``. Reuses the Scenario
    retrieval (vector with a keyword fallback, no external key required) and returns
    ``{"related_questions": [{slug, title}, ...]}`` localized to the requested language, with
    the just-asked question excluded. Keyless: it degrades to keyword overlap in mock mode.
    """

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        # B1 — guests get related questions too, but only while guest chat is enabled.
        if getattr(settings, "GUEST_CHAT_ENABLED", False):
            return [AllowAny()]
        return super().get_permissions()

    def get_throttles(self):
        # Anonymous callers share the guest IP budget; signed-in users are unthrottled here.
        if not self.request.user or not self.request.user.is_authenticated:
            return [GuestBurstThrottle()]
        return []

    def get(self, request):
        message = request.query_params.get("message", "")
        language = request.query_params.get("lang", "")
        if language not in ("uz", "ru", "en"):
            language = "uz"
        exclude_slug = request.query_params.get("exclude") or None
        questions = retrieval.related_questions(
            message, language, exclude_slug=exclude_slug
        )
        return Response({"related_questions": questions})


class GuestMessageStreamView(APIView):
    """B1 — anonymous, stateless chat turn streamed via SSE (feature-flagged).

    ``POST /api/chat/guest/stream/`` with ``{content, language, plain?, history: [...]}``.
    Nothing is stored server-side: the client keeps the thread. Throttled per IP
    (``GUEST_THROTTLE_*``) and refused with 404 unless ``GUEST_CHAT_ENABLED`` is on, so the
    endpoint does not exist from the outside until an operator opts in.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [GuestBurstThrottle, GuestSustainedThrottle]

    def initial(self, request, *args, **kwargs):
        if not getattr(settings, "GUEST_CHAT_ENABLED", False):
            raise Http404
        super().initial(request, *args, **kwargs)

    def throttled(self, request, wait):
        language = request.data.get("language")
        if language not in THROTTLE_MESSAGE:
            language = "uz"
        raise Throttled(wait=wait, detail=THROTTLE_MESSAGE[language])

    def post(self, request):
        serializer = GuestMessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]
        language = reply_language(content, serializer.validated_data.get("language") or "uz")
        plain = serializer.validated_data.get("plain", False)
        history = list(serializer.validated_data.get("history") or [])
        history.append({"role": "user", "content": content})

        snippets = services.retrieve_snippets(history, language)
        sources = services.sources_from_snippets(snippets)

        def event_stream():
            yield _sse("meta", {"guest": True, "language": language})
            parts: list[str] = []
            for chunk in services.stream_reply(
                history, language, snippets=snippets, plain=plain
            ):
                parts.append(chunk)
                yield _sse_data({"delta": chunk})
            if sources:
                yield _sse("sources", {"sources": sources})
            yield _sse("done", {"assistant_message_id": None, "content": "".join(parts)})

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class PublicConfigView(APIView):
    """``GET /api/config/`` — feature flags the SPA needs before rendering.

    Only booleans/labels that are safe to expose; never keys or limits.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(
            {
                "guest_chat": bool(getattr(settings, "GUEST_CHAT_ENABLED", False)),
                "chat_mode": getattr(settings, "CHAT_MODE", "ai"),
                "ai_mode": "catalog_only"
                if services.is_catalog_only()
                else ("mock" if services.is_mock_mode() else "live"),
                "telegram_bot": bool(getattr(settings, "TELEGRAM_BOT_TOKEN", "")),
            }
        )


def _sse_data(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
