"""E5 catalog-only kill-switch, A6 ungrounded instruction, B1 guest chat, public config,
A7 reply language, R5 plain language, D1 Telegram webhook."""
import json
from unittest import mock

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat import services
from chat.models import Conversation, Message
from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def passport():
    cat = Category.objects.create(slug="docs", name={"en": "Docs"}, order=1)
    return Scenario.objects.create(
        category=cat,
        slug="passport-renewal",
        title={"en": "Passport renewal", "ru": "Замена паспорта", "uz": "Pasport almashtirish"},
        body={"en": "How to renew your passport at the migration office."},
        source_url="https://gov.uz/passport",
        is_published=True,
    )


def _sse_events(response):
    body = b"".join(response.streaming_content).decode()
    events = []
    for frame in body.strip().split("\n\n"):
        name, data = "message", None
        for line in frame.splitlines():
            if line.startswith("event:"):
                name = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data = json.loads(line.split(":", 1)[1].strip())
        events.append((name, data))
    return events


# ---------------------------------------------------------------------------
# E5 — catalog-only mode
# ---------------------------------------------------------------------------
@override_settings(CHAT_MODE="catalog_only")
def test_catalog_only_reply_links_matching_scenarios(passport):
    messages = [{"role": "user", "content": "How do I renew my passport?"}]
    reply = services.generate_reply(messages, "en")
    assert reply["model"] == "catalog"
    assert "/scenarios/passport-renewal" in reply["content"]
    assert "turned off" in reply["content"]


@override_settings(CHAT_MODE="catalog_only")
def test_catalog_only_never_calls_openai(passport):
    with mock.patch("chat.services._client", side_effect=AssertionError("LLM called")) as client:
        reply = services.generate_reply([{"role": "user", "content": "zzz unknown"}], "ru")
    assert "каталог" in reply["content"].lower()
    client.assert_not_called()


@override_settings(CHAT_MODE="catalog_only")
def test_catalog_only_stream_and_model_label(passport):
    chunks = list(services.stream_reply([{"role": "user", "content": "passport renew"}], "en"))
    assert len(chunks) == 1
    assert "/scenarios/passport-renewal" in chunks[0]
    assert services.reply_model_label() == "catalog"


# ---------------------------------------------------------------------------
# A7 / R5 — reply language and plain-language flag through the API
# ---------------------------------------------------------------------------
@pytest.fixture
def auth_client():
    user = User.objects.create_user(email="m@example.com", password="pw-123-strong")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def test_reply_language_follows_question(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="uz")
    with mock.patch(
        "chat.views.services.generate_reply",
        return_value={"content": "ok", "model": "mock", "tokens": None},
    ) as gen:
        resp = client.post(
            reverse("message-create", args=[conv.id]),
            {"content": "How do I renew my passport?", "language": "uz", "plain": True},
            format="json",
        )
    assert resp.status_code == 201
    assert resp.json()["language"] == "en"
    args, kwargs = gen.call_args
    assert args[1] == "en"
    assert kwargs["plain"] is True


@override_settings(CHAT_AUTODETECT_LANGUAGE=False)
def test_reply_language_detection_can_be_disabled(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="uz")
    resp = client.post(
        reverse("message-create", args=[conv.id]),
        {"content": "How do I renew my passport?", "language": "uz"},
        format="json",
    )
    assert resp.json()["language"] == "uz"


def test_plain_language_instruction_in_payload():
    payload = services.build_payload(
        [{"role": "user", "content": "hi"}], "en", snippets=[], plain=True
    )
    assert "very simple words" in payload[0]["content"]
    assert "clarifying" in payload[0]["content"]


# ---------------------------------------------------------------------------
# B1 — guest chat
# ---------------------------------------------------------------------------
def test_guest_chat_is_hidden_by_default():
    resp = APIClient().post(reverse("guest-stream"), {"content": "hi"}, format="json")
    assert resp.status_code == 404


@override_settings(GUEST_CHAT_ENABLED=True)
def test_guest_chat_streams_without_storing(passport):
    before = Message.objects.count()
    resp = APIClient().post(
        reverse("guest-stream"),
        {
            "content": "How do I renew my passport?",
            "language": "en",
            "history": [{"role": "user", "content": "hello"}, {"role": "assistant", "content": "hi"}],
        },
        format="json",
    )
    assert resp.status_code == 200
    events = _sse_events(resp)
    names = [n for n, _ in events]
    assert names[0] == "meta" and events[0][1]["guest"] is True
    assert "sources" in names and names[-1] == "done"
    assert Message.objects.count() == before  # nothing persisted


@override_settings(GUEST_CHAT_ENABLED=True)
def test_guest_chat_is_ip_throttled(monkeypatch):
    from chat.throttles import GuestBurstThrottle, GuestSustainedThrottle

    # Same pattern as the A1 chat throttle test: DRF reads rates at class level.
    monkeypatch.setattr(GuestBurstThrottle, "get_rate", lambda self: "2/min")
    monkeypatch.setattr(GuestSustainedThrottle, "get_rate", lambda self: "100/day")
    client = APIClient()
    codes = [
        client.post(reverse("guest-stream"), {"content": "hi", "language": "en"}, format="json").status_code
        for _ in range(3)
    ]
    assert codes[:2] == [200, 200]
    assert codes[2] == 429


@override_settings(GUEST_CHAT_ENABLED=True)
def test_guest_chat_rejects_overlong_message():
    resp = APIClient().post(
        reverse("guest-stream"), {"content": "x" * 10000, "language": "en"}, format="json"
    )
    assert resp.status_code == 400


def test_public_config_reports_flags():
    data = APIClient().get(reverse("public-config")).json()
    assert data == {
        "guest_chat": False,
        "chat_mode": "ai",
        "ai_mode": "mock",
        "telegram_bot": False,
    }


# ---------------------------------------------------------------------------
# D1 — Telegram webhook
# ---------------------------------------------------------------------------
def _update(text, chat_id=42, lang="en"):
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "chat": {"id": chat_id, "type": "private"},
            "from": {"id": chat_id, "language_code": lang},
            "text": text,
        },
    }


def test_telegram_webhook_hidden_without_token():
    resp = APIClient().post(reverse("telegram-webhook"), _update("hi"), format="json")
    assert resp.status_code == 404


@override_settings(TELEGRAM_BOT_TOKEN="123:abc", TELEGRAM_WEBHOOK_SECRET="s3cret")
def test_telegram_webhook_requires_secret():
    resp = APIClient().post(reverse("telegram-webhook"), _update("hi"), format="json")
    assert resp.status_code == 403


@override_settings(TELEGRAM_BOT_TOKEN="123:abc", TELEGRAM_WEBHOOK_SECRET="s3cret")
def test_telegram_webhook_answers_with_grounded_reply(passport):
    with mock.patch("chat.telegram.httpx.post") as post:
        resp = APIClient().post(
            reverse("telegram-webhook"),
            _update("How do I renew my passport?"),
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="s3cret",
        )
    assert resp.status_code == 200
    sent = post.call_args.kwargs["json"]
    assert sent["chat_id"] == 42
    assert "https://gov.uz/passport" in sent["text"]  # sources appended
    assert Message.objects.count() == 0  # stateless


@override_settings(TELEGRAM_BOT_TOKEN="123:abc", TELEGRAM_WEBHOOK_SECRET="s3cret")
def test_telegram_start_command_sends_greeting():
    with mock.patch("chat.telegram.httpx.post") as post:
        APIClient().post(
            reverse("telegram-webhook"),
            _update("/start", lang="ru"),
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="s3cret",
        )
    assert "GovBot" in post.call_args.kwargs["json"]["text"]
    assert "Здравствуйте" in post.call_args.kwargs["json"]["text"]
