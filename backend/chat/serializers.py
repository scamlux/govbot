from django.conf import settings
from rest_framework import serializers

from .i18n import MESSAGE_EMPTY, MESSAGE_TOO_LONG, resolve_language
from .models import Conversation, Message, MessageFeedback


class MessageFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageFeedback
        fields = ["rating", "reason", "created_at", "updated_at"]
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    feedback = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "role", "content", "model", "tokens", "sources", "feedback", "created_at"
        ]
        read_only_fields = fields

    def get_feedback(self, obj):
        # Reverse OneToOne: missing feedback raises RelatedObjectDoesNotExist, which
        # subclasses AttributeError, so getattr degrades to None.
        feedback = getattr(obj, "feedback", None)
        return MessageFeedbackSerializer(feedback).data if feedback else None


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

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
    # allow_blank so DRF hands blank/whitespace input to validate_content, which raises the
    # localized MESSAGE_EMPTY instead of DRF's untranslated "This field may not be blank."
    content = serializers.CharField(trim_whitespace=True, allow_blank=True)
    language = serializers.ChoiceField(
        choices=["uz", "ru", "en"], required=False, default="uz"
    )

    def _error_language(self) -> str:
        candidate = None
        if isinstance(self.initial_data, dict):
            candidate = self.initial_data.get("language")
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return resolve_language(candidate, user)

    def validate_content(self, value):
        lang = self._error_language()
        if not value.strip():
            raise serializers.ValidationError(MESSAGE_EMPTY[lang])
        max_length = settings.CHAT_MAX_MESSAGE_LENGTH
        if len(value) > max_length:
            raise serializers.ValidationError(
                MESSAGE_TOO_LONG[lang].format(max=max_length)
            )
        return value


class CreateFeedbackSerializer(serializers.Serializer):
    rating = serializers.ChoiceField(
        choices=[MessageFeedback.UP, MessageFeedback.DOWN]
    )
    reason = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=True, max_length=2000,
        default="",
    )


class AdminFeedbackSerializer(serializers.ModelSerializer):
    """One feedback row for the staff dashboard (A3): the verdict plus enough of the rated
    answer and its language to triage quality without opening each conversation."""

    message_id = serializers.IntegerField(source="message.id", read_only=True)
    conversation_id = serializers.IntegerField(
        source="message.conversation_id", read_only=True
    )
    answer = serializers.CharField(source="message.content", read_only=True)
    language = serializers.CharField(
        source="message.conversation.language", read_only=True
    )

    class Meta:
        model = MessageFeedback
        fields = [
            "id", "rating", "reason", "created_at",
            "message_id", "conversation_id", "answer", "language",
        ]
        read_only_fields = fields
