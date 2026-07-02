from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    MessageCreateView,
    MessageFeedbackView,
    MessageStreamView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation-list"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<int:pk>/messages/", MessageCreateView.as_view(), name="message-create"),
    path("conversations/<int:pk>/messages/stream/", MessageStreamView.as_view(), name="message-stream"),
    # A2 — rate an assistant reply (owner-only, idempotent upsert).
    path("messages/<int:pk>/feedback/", MessageFeedbackView.as_view(), name="message-feedback"),
]
