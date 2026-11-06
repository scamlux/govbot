"""P0 — chat never fails silently: OpenAI failure -> catalog fallback + circuit breaker."""
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


class RateLimitError(Exception):
    """Stand-in for openai.RateLimitError (insufficient_quota)."""


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def live_key(settings):
    settings.OPENAI_API_KEY = "sk-test"
    settings.LLM_COOLDOWN_SECONDS = 120


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


@pytest.fixture
def auth_client():
    user = User.objects.create_user(email="f@example.com", password="pw-123-strong")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


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


MSG = [{"role": "user", "content": "How do I renew my passport?"}]


def test_rate_limit_falls_back_to_catalog_links(live_key, passport):
    with mock.patch("chat.services._client", side_effect=RateLimitError("insufficient_quota")):
        reply = services.generate_reply(MSG, "en")
    assert reply["degraded"] is True
    assert reply["model"] == "fallback"
    assert "/scenarios/passport-renewal" in reply["content"]
    assert services.FRIENDLY_ERROR["en"] not in reply["content"]
    assert reply["sources"]  # citations still surfaced


@pytest.mark.parametrize("lang,needle", [("uz", "AI hozir mavjud emas"), ("ru", "ИИ сейчас недоступен"), ("en", "AI is unavailable")])
def test_fallback_notice_localized(live_key, passport, lang, needle):
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")):
        reply = services.generate_reply(MSG, lang)
    assert needle in reply["content"]


def test_fallback_without_matches_points_to_catalog_and_hotline(live_key):
    with mock.patch("chat.services._client", side_effect=RuntimeError("boom")):
        reply = services.generate_reply([{"role": "user", "content": "zzzqqq"}], "en")
    assert reply["degraded"] is True
    assert "/scenarios" in reply["content"]
    assert "my.gov.uz" in reply["content"]
    assert "1242" in reply["content"]


def test_breaker_skips_openai_within_cooldown(live_key, passport):
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")) as client:
        services.generate_reply(MSG, "en")
        assert client.call_count == 1
        second = services.generate_reply(MSG, "en")
        assert client.call_count == 1  # breaker open: not called again
    assert second["degraded"] is True
    assert second["model"] == "fallback"


def test_breaker_closes_after_cooldown(live_key, passport):
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")):
        services.generate_reply(MSG, "en")
    cache.delete(services.LLM_COOLDOWN_KEY)
    ok = mock.Mock()
    ok.chat.completions.create.return_value = mock.Mock(
        choices=[mock.Mock(message=mock.Mock(content="Real answer"))],
        usage=mock.Mock(total_tokens=5),
    )
    with mock.patch("chat.services._client", return_value=ok):
        reply = services.generate_reply(MSG, "en")
    assert reply["content"] == "Real answer"
    assert not reply.get("degraded")
    assert services.llm_status()["llm_ok"] is True


def test_stream_falls_back_and_flags_degraded(live_key, passport):
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")):
        chunks = list(services.stream_reply(MSG, "en"))
    assert any(isinstance(c, services.FallbackChunk) for c in chunks)
    assert "/scenarios/passport-renewal" in "".join(chunks)


def test_stream_view_emits_status_frame_and_persists_fallback_model(live_key, passport, auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")):
        resp = client.post(
            reverse("message-stream", args=[conv.id]),
            {"content": "How do I renew my passport?", "language": "en"},
            format="json",
        )
        events = _sse_events(resp)
    names = [n for n, _ in events]
    assert names.index("status") < names.index("done")
    status = dict(events)["status"]
    assert status == {"degraded": True, "reason": "llm_unavailable"}
    assert Message.objects.filter(conversation=conv, role="assistant", model="fallback").exists()


def test_message_view_returns_degraded_flag(live_key, passport, auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")):
        resp = client.post(
            reverse("message-create", args=[conv.id]),
            {"content": "How do I renew my passport?", "language": "en"},
            format="json",
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["degraded"] is True
    assert data["assistant_message"]["model"] == "fallback"


def test_config_reports_degraded_while_breaker_open(live_key, passport):
    client = APIClient()
    assert client.get("/api/config/").json()["ai_mode"] == "live"
    with mock.patch("chat.services._client", side_effect=RateLimitError("x")):
        services.generate_reply(MSG, "en")
    assert client.get("/api/config/").json()["ai_mode"] == "degraded"


def test_llm_health_endpoint_reports_status_without_secrets(live_key, passport):
    client = APIClient()
    assert client.get("/api/health/llm/").json()["llm_ok"] is True
    with mock.patch("chat.services._client", side_effect=RateLimitError("sk-secret-detail")):
        services.generate_reply(MSG, "en")
    body = client.get("/api/health/llm/").json()
    assert body["llm_ok"] is False
    assert body["last_error"] == "RateLimitError"
    assert "sk-secret" not in json.dumps(body)


@override_settings(OPENAI_API_KEY="")
def test_mock_mode_health_is_ok():
    assert services.llm_status()["llm_ok"] is True
