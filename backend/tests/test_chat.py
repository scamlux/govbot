from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message

pytestmark = pytest.mark.django_db


@pytest.fixture
def auth_client():
    user = User.objects.create_user(email="u@example.com", full_name="U", password="pw-123-strong")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def test_create_conversation(auth_client):
    client, _ = auth_client
    resp = client.post(reverse("conversation-list"), {"language": "ru"}, format="json")
    assert resp.status_code == 201
    assert resp.json()["language"] == "ru"


@mock.patch(
    "chat.views.services.generate_reply",
    return_value={"content": "Mocked AI reply.", "model": "mock", "tokens": 7},
)
def test_send_message_persists_and_returns_reply(mock_gen, auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")

    url = reverse("message-create", args=[conv.id])
    resp = client.post(url, {"content": "How do I renew my passport?", "language": "en"}, format="json")

    assert resp.status_code == 201
    data = resp.json()
    assert data["user_message"]["content"] == "How do I renew my passport?"
    assert data["assistant_message"]["content"] == "Mocked AI reply."
    assert Message.objects.filter(conversation=conv).count() == 2
    mock_gen.assert_called_once()

    conv.refresh_from_db()
    assert conv.title  # auto-generated from first message


def test_empty_message_rejected(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    resp = client.post(reverse("message-create", args=[conv.id]), {"content": "   "}, format="json")
    assert resp.status_code == 400


def test_user_cannot_access_others_conversation(auth_client):
    client, _ = auth_client
    other = User.objects.create_user(email="o@example.com", password="pw-456-strong")
    foreign = Conversation.objects.create(user=other, language="en")
    resp = client.get(reverse("conversation-detail", args=[foreign.id]))
    assert resp.status_code == 404


def test_message_stream_returns_sse(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-stream", args=[conv.id])
    resp = client.post(url, {"content": "Hello", "language": "en"}, format="json")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/event-stream")
    body = b"".join(resp.streaming_content).decode()
    assert "event: meta" in body
    assert "event: done" in body
    # Mock-mode reply persisted.
    assert Message.objects.filter(conversation=conv, role="assistant").exists()
