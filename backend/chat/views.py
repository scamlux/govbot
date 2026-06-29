import json

from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Conversation, Message
from .serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    CreateMessageSerializer,
    MessageSerializer,
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
            .prefetch_related("messages")
        )


def _get_conversation(user, pk) -> Conversation:
    return get_object_or_404(Conversation, pk=pk, user=user)


def _history_payload(conversation) -> list[dict]:
    return [
        {"role": m.role, "content": m.content}
        for m in conversation.messages.all()
    ]


class MessageCreateView(APIView):
    """Persist a user message, call the AI, persist + return the assistant reply (JSON)."""

    permission_classes = [IsAuthenticated]

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
            },
            status=status.HTTP_201_CREATED,
        )


class MessageStreamView(APIView):
    """Same as MessageCreateView but streams the assistant reply via Server-Sent Events.

    SSE protocol:
      event: meta   -> {"user_message_id": ...}
      data: {"delta": "..."}        (repeated)
      event: done   -> {"assistant_message_id": ..., "content": "..."}
    """

    permission_classes = [IsAuthenticated]

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

        def event_stream():
            yield _sse("meta", {"user_message_id": user_msg.id})
            parts: list[str] = []
            for chunk in services.stream_reply(history, language):
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


def _sse_data(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
