from django.conf import settings
from rest_framework import serializers

from .models import Conversation, Message, MessageFeedback

# S3 — localized message when a chat message exceeds the server-side length cap.
TOO_LONG_MESSAGE = {
    "uz": "Xabar juda uzun. Iltimos, qisqartiring.",
    "ru": "Сообщение слишком длинное. Пожалуйста, сократите его.",
    "en": "Message is too long. Please shorten it.",
}

# Localized message when a chat message is blank/empty.
EMPTY_MESSAGE = {
    "uz": "Xabar bo'sh bo'lishi mumkin emas.",
    "ru": "Сообщение не может быть пустым.",
    "en": "Message cannot be empty.",
}

_LANGS = ("uz", "ru", "en")


class MessageFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageFeedback
        fields = ["rating", "reason", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_reason(self, value):
        return (value or "").strip()


class MessageSerializer(serializers.ModelSerializer):
    # A2 — the caller's own rating (if any), so the UI can render active thumbs on reload.
    feedback = MessageFeedbackSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "role", "content", "model", "tokens", "sources", "feedback", "created_at"]
        read_only_fields = fields


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()

    def get_message_count(self, obj):
        # Prefer the annotation from ConversationListView (list path, no per-row query);
        # fall back to a direct count for the freshly-created, un-annotated instance
        # returned by the create response.
        count = getattr(obj, "message_count", None)
        return count if count is not None else obj.messages.count()

    class Meta:
        model = Conversation
        fields = ["id", "title", "language", "message_count", "created_at", "updated_at"]
        read_only_fields = ["id", "title", "message_count", "created_at", "updated_at"]


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "title", "language", "messages", "created_at", "updated_at"]
        read_only_fields = ["id", "title", "messages", "created_at", "updated_at"]


class CreateMessageSerializer(serializers.Serializer):
    # allow_blank so a blank body reaches validate_content (which raises a
    # localized error) instead of DRF's untranslated "may not be blank".
    content = serializers.CharField(trim_whitespace=True, allow_blank=True)
    language = serializers.ChoiceField(
        choices=["uz", "ru", "en"], required=False, default="uz"
    )

    def _error_lang(self):
        """Resolve the error language: request body -> user's preferred -> uz."""
        lang = None
        if isinstance(self.initial_data, dict):
            lang = self.initial_data.get("language")
        if lang not in _LANGS:
            user = getattr(self.context.get("request"), "user", None)
            lang = getattr(user, "preferred_language", None)
        return lang if lang in _LANGS else "uz"

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError(EMPTY_MESSAGE[self._error_lang()])
        # S3 — enforce the length cap server-side with a localized message.
        max_chars = getattr(settings, "CHAT_MAX_MESSAGE_CHARS", 4000)
        if len(value) > max_chars:
            raise serializers.ValidationError(TOO_LONG_MESSAGE[self._error_lang()])
        return value
