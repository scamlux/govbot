from django.contrib import admin

from .models import Conversation, Message, MessageFeedback


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ["role", "content", "model", "tokens", "created_at"]
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["__str__", "user", "language", "updated_at"]
    list_filter = ["language", "created_at"]
    search_fields = ["title", "user__email"]
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["conversation", "role", "model", "tokens", "created_at"]
    list_filter = ["role", "model"]
    search_fields = ["content"]


@admin.register(MessageFeedback)
class MessageFeedbackAdmin(admin.ModelAdmin):
    """A3 — surface ratings so admins can find weak answers (read-only)."""

    list_display = ["rating", "message", "short_reason", "created_at"]
    list_filter = ["rating", "created_at"]
    search_fields = ["reason", "message__content"]
    readonly_fields = ["message", "rating", "reason", "created_at", "updated_at"]

    @admin.display(description="reason")
    def short_reason(self, obj):
        return (obj.reason[:60] + "…") if len(obj.reason) > 60 else obj.reason
