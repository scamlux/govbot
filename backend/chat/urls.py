from django.urls import path

from .telegram import TelegramWebhookView
from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    GuestMessageStreamView,
    MessageCreateView,
    MessageFeedbackView,
    MessageStreamView,
    PublicConfigView,
    RelatedQuestionsView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation-list"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<int:pk>/messages/", MessageCreateView.as_view(), name="message-create"),
    path("conversations/<int:pk>/messages/stream/", MessageStreamView.as_view(), name="message-stream"),
    # A2 — rate an assistant reply (owner-only, idempotent upsert).
    path("messages/<int:pk>/feedback/", MessageFeedbackView.as_view(), name="message-feedback"),
    # R4 — related questions from the scenario catalog, shown after an assistant reply.
    path("chat/related/", RelatedQuestionsView.as_view(), name="chat-related"),
    # B1 — stateless guest chat (404 unless GUEST_CHAT_ENABLED).
    path("chat/guest/stream/", GuestMessageStreamView.as_view(), name="guest-stream"),
    # Public, non-secret feature flags for the SPA.
    path("config/", PublicConfigView.as_view(), name="public-config"),
    # D1 — Telegram bot webhook (404 unless TELEGRAM_BOT_TOKEN is set).
    path("telegram/webhook/", TelegramWebhookView.as_view(), name="telegram-webhook"),
]
