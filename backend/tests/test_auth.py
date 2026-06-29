import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db


def register(client, **overrides):
    payload = {
        "email": "citizen@example.com",
        "password": "Str0ngPass!23",
        "full_name": "Test Citizen",
    }
    payload.update(overrides)
    return client.post(reverse("register"), payload, format="json")


def test_register_creates_user_and_returns_jwt():
    client = APIClient()
    resp = register(client)

    assert resp.status_code == 201
    data = resp.json()
    assert "access" in data and "refresh" in data
    assert data["user"]["email"] == "citizen@example.com"

    user = User.objects.get(email="citizen@example.com")
    assert user.has_usable_password()
    assert user.check_password("Str0ngPass!23")


def test_register_rejects_duplicate_email():
    client = APIClient()
    register(client)
    resp = register(client)
    assert resp.status_code == 400
    assert "email" in resp.json()


def test_register_rejects_weak_password():
    client = APIClient()
    resp = register(client, password="123")
    assert resp.status_code == 400
    assert "password" in resp.json()


def test_login_with_valid_credentials():
    client = APIClient()
    register(client)

    resp = client.post(
        reverse("login"),
        {"email": "citizen@example.com", "password": "Str0ngPass!23"},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access" in data and "refresh" in data
    assert data["user"]["email"] == "citizen@example.com"


def test_login_with_wrong_password_fails():
    client = APIClient()
    register(client)
    resp = client.post(
        reverse("login"),
        {"email": "citizen@example.com", "password": "wrong-password"},
        format="json",
    )
    assert resp.status_code == 401


def test_me_endpoint_returns_profile_and_updates_language():
    client = APIClient()
    access = register(client).json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    me = client.get(reverse("me"))
    assert me.status_code == 200
    assert me.json()["email"] == "citizen@example.com"

    patched = client.patch(reverse("me"), {"preferred_language": "en"}, format="json")
    assert patched.status_code == 200
    assert patched.json()["preferred_language"] == "en"


def test_me_requires_auth():
    resp = APIClient().get(reverse("me"))
    assert resp.status_code == 401
