from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    MessageCreateView,
    MessageStreamView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation-list"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<int:pk>/messages/", MessageCreateView.as_view(), name="message-create"),
    path("conversations/<int:pk>/messages/stream/", MessageStreamView.as_view(), name="message-stream"),
]
