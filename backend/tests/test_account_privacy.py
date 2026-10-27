"""F2 server-side logout, F3 account self-delete + data export."""
import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message

pytestmark = pytest.mark.django_db

PASSWORD = "pw-123-strong"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _login(email="p@example.com", **extra):
    user = User.objects.create_user(email=email, password=PASSWORD, **extra)
    client = APIClient()
    tokens = client.post(
        reverse("login"), {"email": email, "password": PASSWORD}, format="json"
    ).json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client, user, tokens


# ---------------------------------------------------------------------------
# F2 — logout revokes the refresh token
# ---------------------------------------------------------------------------
def test_logout_blacklists_refresh_token():
    client, _, tokens = _login()
    resp = client.post(reverse("logout"), {"refresh": tokens["refresh"]}, format="json")
    assert resp.status_code == 205
    again = APIClient().post(
        reverse("token-refresh"), {"refresh": tokens["refresh"]}, format="json"
    )
    assert again.status_code == 401


def test_logout_is_idempotent_and_validates_input():
    client, _, tokens = _login()
    client.post(reverse("logout"), {"refresh": tokens["refresh"]}, format="json")
    assert client.post(reverse("logout"), {"refresh": tokens["refresh"]}, format="json").status_code == 205
    assert client.post(reverse("logout"), {}, format="json").status_code == 400


def test_rotated_refresh_token_cannot_be_reused():
    _, _, tokens = _login()
    client = APIClient()
    first = client.post(reverse("token-refresh"), {"refresh": tokens["refresh"]}, format="json")
    assert first.status_code == 200
    reuse = client.post(reverse("token-refresh"), {"refresh": tokens["refresh"]}, format="json")
    assert reuse.status_code == 401


# ---------------------------------------------------------------------------
# F3 — delete account
# ---------------------------------------------------------------------------
def test_delete_account_requires_password():
    client, user, _ = _login()
    resp = client.post(reverse("me-delete"), {"password": "wrong"}, format="json")
    assert resp.status_code == 400
    assert User.objects.filter(pk=user.pk).exists()


def test_delete_account_removes_user_conversations_and_tokens():
    client, user, tokens = _login()
    conv = Conversation.objects.create(user=user, language="en")
    Message.objects.create(conversation=conv, role=Message.USER, content="hi")
    resp = client.post(reverse("me-delete"), {"password": PASSWORD}, format="json")
    assert resp.status_code == 204
    assert not User.objects.filter(pk=user.pk).exists()
    assert not Conversation.objects.filter(pk=conv.pk).exists()
    refresh = APIClient().post(reverse("token-refresh"), {"refresh": tokens["refresh"]}, format="json")
    assert refresh.status_code == 401


def test_last_admin_cannot_delete_self():
    client, admin, _ = _login(email="admin@example.com", is_staff=True)
    resp = client.post(reverse("me-delete"), {"password": PASSWORD}, format="json")
    assert resp.status_code == 400
    assert User.objects.filter(pk=admin.pk).exists()


def test_admin_can_delete_self_when_another_admin_exists():
    User.objects.create_user(email="other@example.com", password=PASSWORD, is_staff=True)
    client, admin, _ = _login(email="admin@example.com", is_staff=True)
    assert client.post(reverse("me-delete"), {"password": PASSWORD}, format="json").status_code == 204


# ---------------------------------------------------------------------------
# F3 — export
# ---------------------------------------------------------------------------
def test_export_returns_profile_and_conversations():
    client, user, _ = _login()
    conv = Conversation.objects.create(user=user, language="en", title="Visa")
    Message.objects.create(conversation=conv, role=Message.USER, content="visa?")
    resp = client.get(reverse("me-export"))
    assert resp.status_code == 200
    assert "attachment" in resp["Content-Disposition"]
    data = resp.json()
    assert data["profile"]["email"] == user.email
    assert data["conversations"][0]["title"] == "Visa"
    assert data["conversations"][0]["messages"][0]["content"] == "visa?"


def test_export_requires_auth():
    assert APIClient().get(reverse("me-export")).status_code == 401
