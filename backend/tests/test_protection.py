"""A1 (rate limiting) + S3 (max message length) on the chat message endpoints."""
from unittest import mock

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.test import APIClient

from accounts.models import User
from chat.i18n import MESSAGE_EMPTY, MESSAGE_TOO_LONG, THROTTLED_MESSAGE
from chat.models import Conversation

pytestmark = pytest.mark.django_db

MOCK_REPLY = {"content": "Mocked AI reply.", "model": "mock", "tokens": 7, "sources": []}


@pytest.fixture
def auth_client():
    user = User.objects.create_user(
        email="limits@example.com", full_name="L", password="pw-123-strong"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture(autouse=True)
def _clean_throttle_cache():
    """Throttle counters live in the default cache — isolate them per test."""
    cache.clear()
    yield
    cache.clear()


def _burst_rate(rate: str):
    # DRF binds THROTTLE_RATES to the settings dict at import time, so patch the dict
    # the throttle classes actually read instead of override_settings(REST_FRAMEWORK=...).
    return mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {"chat_burst": rate})


# ---------------------------------------------------------------------------
# A1 — rate limiting
# ---------------------------------------------------------------------------
@mock.patch("chat.views.services.generate_reply", return_value=MOCK_REPLY)
def test_message_endpoint_throttled_with_localized_429(mock_gen, auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="ru")
    url = reverse("message-create", args=[conv.id])

    with _burst_rate("2/min"):
        for _ in range(2):
            resp = client.post(url, {"content": "Salom", "language": "ru"}, format="json")
            assert resp.status_code == 201

        resp = client.post(url, {"content": "Salom", "language": "ru"}, format="json")
        assert resp.status_code == 429
        assert resp.json()["detail"] == THROTTLED_MESSAGE["ru"]


@mock.patch("chat.views.services.generate_reply", return_value=MOCK_REPLY)
def test_throttle_shared_between_plain_and_stream_endpoints(mock_gen, auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")

    with _burst_rate("1/min"):
        resp = client.post(
            reverse("message-create", args=[conv.id]),
            {"content": "Hello", "language": "en"},
            format="json",
        )
        assert resp.status_code == 201

        # Both endpoints share the same per-user budget (same throttle scopes).
        resp = client.post(
            reverse("message-stream", args=[conv.id]),
            {"content": "Hello again", "language": "en"},
            format="json",
        )
        assert resp.status_code == 429
        assert resp.json()["detail"] == THROTTLED_MESSAGE["en"]


@mock.patch("chat.views.services.generate_reply", return_value=MOCK_REPLY)
def test_throttle_is_per_user(mock_gen, auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-create", args=[conv.id])

    other = User.objects.create_user(
        email="other-limits@example.com", full_name="O", password="pw-123-strong"
    )
    other_conv = Conversation.objects.create(user=other, language="en")
    other_client = APIClient()
    other_client.force_authenticate(user=other)

    with _burst_rate("1/min"):
        assert client.post(url, {"content": "Hi"}, format="json").status_code == 201
        assert client.post(url, {"content": "Hi"}, format="json").status_code == 429
        # A different user still has their own budget.
        resp = other_client.post(
            reverse("message-create", args=[other_conv.id]),
            {"content": "Hi"},
            format="json",
        )
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# S3 — max message length
# ---------------------------------------------------------------------------
@override_settings(CHAT_MAX_MESSAGE_LENGTH=50)
def test_oversized_message_rejected_with_localized_400(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-create", args=[conv.id])

    resp = client.post(url, {"content": "x" * 51, "language": "en"}, format="json")
    assert resp.status_code == 400
    assert MESSAGE_TOO_LONG["en"].format(max=50) in resp.json()["content"]


@override_settings(CHAT_MAX_MESSAGE_LENGTH=50)
def test_message_at_limit_accepted(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-create", args=[conv.id])

    with mock.patch("chat.views.services.generate_reply", return_value=MOCK_REPLY):
        resp = client.post(url, {"content": "x" * 50, "language": "en"}, format="json")
    assert resp.status_code == 201


def test_blank_message_returns_localized_empty_error(auth_client):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="ru")
    url = reverse("message-create", args=[conv.id])

    # Whitespace-only content must yield the localized MESSAGE_EMPTY string, not DRF's
    # untranslated "This field may not be blank." (regression guard for the allow_blank fix).
    resp = client.post(url, {"content": "   ", "language": "ru"}, format="json")
    assert resp.status_code == 400
    assert MESSAGE_EMPTY["ru"] in resp.json()["content"]


@override_settings(CHAT_MAX_MESSAGE_LENGTH=50)
def test_error_language_falls_back_to_user_preferred():
    # No `language` in the request body → the resolver must fall back to the user's
    # preferred_language before defaulting to uz (regression guard for the context fix).
    user = User.objects.create_user(
        email="pref@example.com",
        full_name="P",
        password="pw-123-strong",
        preferred_language="ru",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    conv = Conversation.objects.create(user=user, language="ru")
    url = reverse("message-create", args=[conv.id])

    resp = client.post(url, {"content": "x" * 51}, format="json")
    assert resp.status_code == 400
    assert MESSAGE_TOO_LONG["ru"].format(max=50) in resp.json()["content"]
