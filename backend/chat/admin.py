from django.contrib import admin

from .models import Conversation, Message


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
