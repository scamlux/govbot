from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "model", "tokens", "created_at"]
        read_only_fields = fields


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
    content = serializers.CharField(trim_whitespace=True, max_length=4000)
    language = serializers.ChoiceField(
        choices=["uz", "ru", "en"], required=False, default="uz"
    )

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value
