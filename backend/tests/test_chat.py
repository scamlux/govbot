from unittest import mock

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message, MessageFeedback
from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def auth_client():
    user = User.objects.create_user(email="u@example.com", full_name="U", password="pw-123-strong")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def _published_passport_scenario():
    """A published scenario that keyword-retrieval will match on 'passport'."""
    cat = Category.objects.create(slug="docs", name={"en": "Docs"}, order=1)
    return Scenario.objects.create(
        category=cat,
        slug="passport-renewal",
        title={"en": "Passport renewal", "ru": "Замена паспорта", "uz": "Pasport almashtirish"},
        body={"en": "How to renew your passport at the migration office."},
        source_url="https://gov.uz/passport",
        is_published=True,
    )


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


# --------------------------------------------------------------------------- #
# A1 — rate limiting
# --------------------------------------------------------------------------- #
def test_chat_rate_limit_returns_localized_429(auth_client, monkeypatch):
    from chat.throttles import ChatBurstThrottle

    cache.clear()
    monkeypatch.setattr(ChatBurstThrottle, "get_rate", lambda self: "1/min")
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="ru")
    url = reverse("message-create", args=[conv.id])

    first = client.post(url, {"content": "salom", "language": "ru"}, format="json")
    assert first.status_code == 201
    second = client.post(url, {"content": "yana", "language": "ru"}, format="json")
    assert second.status_code == 429
    # Localized (ru) throttle message, not DRF's English default.
    assert "Слишком" in str(second.json())
    cache.clear()


# --------------------------------------------------------------------------- #
# A2 — answer feedback
# --------------------------------------------------------------------------- #
def _assistant_message(user):
    conv = Conversation.objects.create(user=user, language="en")
    return Message.objects.create(conversation=conv, role=Message.ASSISTANT, content="Hi")


def test_feedback_upsert_is_idempotent(auth_client):
    client, user = auth_client
    msg = _assistant_message(user)
    url = reverse("message-feedback", args=[msg.id])

    up = client.post(url, {"rating": "up"}, format="json")
    assert up.status_code == 200
    down = client.post(url, {"rating": "down", "reason": "wrong fee"}, format="json")
    assert down.status_code == 200

    assert MessageFeedback.objects.filter(message=msg).count() == 1
    fb = MessageFeedback.objects.get(message=msg)
    assert fb.rating == "down"
    assert fb.reason == "wrong fee"


def test_feedback_only_on_own_assistant_message(auth_client):
    client, user = auth_client
    other = User.objects.create_user(email="x@example.com", password="pw-999-strong")
    foreign = Message.objects.create(
        conversation=Conversation.objects.create(user=other, language="en"),
        role=Message.ASSISTANT,
        content="Hi",
    )
    assert client.post(reverse("message-feedback", args=[foreign.id]), {"rating": "up"}, format="json").status_code == 404


def test_feedback_rejected_on_user_message(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    user_msg = Message.objects.create(conversation=conv, role=Message.USER, content="hello")
    assert client.post(reverse("message-feedback", args=[user_msg.id]), {"rating": "up"}, format="json").status_code == 404


def test_feedback_surfaced_in_conversation_detail(auth_client):
    client, user = auth_client
    msg = _assistant_message(user)
    client.post(reverse("message-feedback", args=[msg.id]), {"rating": "up"}, format="json")
    detail = client.get(reverse("conversation-detail", args=[msg.conversation_id])).json()
    assistant = [m for m in detail["messages"] if m["role"] == "assistant"][0]
    assert assistant["feedback"]["rating"] == "up"


# --------------------------------------------------------------------------- #
# B1 / B3 — structured sources returned + persisted
# --------------------------------------------------------------------------- #
def test_grounded_reply_returns_and_persists_sources(auth_client):
    client, user = auth_client
    _published_passport_scenario()
    conv = Conversation.objects.create(user=user, language="en")

    resp = client.post(
        reverse("message-create", args=[conv.id]),
        {"content": "How do I renew my passport?", "language": "en"},
        format="json",
    )
    assert resp.status_code == 201
    sources = resp.json()["sources"]
    assert any(s["slug"] == "passport-renewal" for s in sources)
    assert sources[0]["source_url"] == "https://gov.uz/passport"

    # B3 — persisted on the assistant message and returned on reload.
    detail = client.get(reverse("conversation-detail", args=[conv.id])).json()
    assistant = [m for m in detail["messages"] if m["role"] == "assistant"][0]
    assert any(s["slug"] == "passport-renewal" for s in assistant["sources"])


def test_ungrounded_reply_has_empty_sources(auth_client):
    client, user = auth_client
    _published_passport_scenario()
    conv = Conversation.objects.create(user=user, language="en")
    resp = client.post(
        reverse("message-create", args=[conv.id]),
        {"content": "zzzzz qqqqq wwwww", "language": "en"},
        format="json",
    )
    assert resp.json()["sources"] == []


def test_stream_emits_sources_frame(auth_client):
    client, user = auth_client
    _published_passport_scenario()
    conv = Conversation.objects.create(user=user, language="en")
    resp = client.post(
        reverse("message-stream", args=[conv.id]),
        {"content": "How do I renew my passport?", "language": "en"},
        format="json",
    )
    body = b"".join(resp.streaming_content).decode()
    assert "event: sources" in body
    assert "passport-renewal" in body


# --------------------------------------------------------------------------- #
# S3 — input hardening
# --------------------------------------------------------------------------- #
@override_settings(CHAT_MAX_MESSAGE_CHARS=10)
def test_oversized_message_rejected_localized(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="ru")
    resp = client.post(
        reverse("message-create", args=[conv.id]),
        {"content": "x" * 50, "language": "ru"},
        format="json",
    )
    assert resp.status_code == 400
    assert "длинное" in str(resp.json())
