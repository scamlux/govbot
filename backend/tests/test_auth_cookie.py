"""F1 — httpOnly refresh cookie (opt-in via ``X-Auth-Cookie: 1``) next to the legacy body flow."""
import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db

PASSWORD = "pw-123-strong"
COOKIE = "govbot_refresh"
OPT_IN = {"HTTP_X_AUTH_COOKIE": "1"}


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user():
    return User.objects.create_user(email="c@example.com", password=PASSWORD)


def _login(client, **extra):
    return client.post(
        reverse("login"), {"email": "c@example.com", "password": PASSWORD}, format="json", **extra
    )


# ---------------------------------------------------------------------------
# Issuing
# ---------------------------------------------------------------------------
def test_login_without_opt_in_is_unchanged(user):
    resp = _login(APIClient())
    assert resp.status_code == 200
    assert resp.json()["refresh"]
    assert COOKIE not in resp.cookies


@override_settings(AUTH_REFRESH_COOKIE_SECURE=True)  # production value (DEBUG off)
def test_login_with_opt_in_moves_refresh_into_a_hardened_cookie(user):
    resp = _login(APIClient(), **OPT_IN)
    assert resp.status_code == 200
    body = resp.json()
    assert "refresh" not in body and body["access"] and body["user"]["email"] == user.email
    morsel = resp.cookies[COOKIE]
    assert morsel.value
    assert morsel["httponly"] is True
    assert morsel["samesite"] == "Lax"  # never None
    assert morsel["path"] == "/api/auth/"
    assert morsel["secure"] is True  # explicit setting, not inferred from the request
    assert int(morsel["max-age"]) == 7 * 24 * 3600


@override_settings(AUTH_REFRESH_COOKIE_SECURE=False)  # local http dev
def test_secure_flag_follows_the_explicit_setting(user):
    assert not _login(APIClient(), **OPT_IN).cookies[COOKIE]["secure"]


def test_secure_is_derived_from_debug_in_settings_source():
    """The rule lives in settings.py: Secure unless DEBUG (not inferred per-request)."""
    from pathlib import Path

    source = (Path(__file__).resolve().parent.parent / "config" / "settings.py").read_text()
    assert "AUTH_REFRESH_COOKIE_SECURE = not DEBUG" in source
    assert 'samesite": "Lax"' in (
        Path(__file__).resolve().parent.parent / "accounts" / "cookies.py"
    ).read_text()


def test_register_with_opt_in_sets_cookie_and_hides_refresh():
    resp = APIClient().post(
        reverse("register"),
        {"email": "new@example.com", "password": PASSWORD, "full_name": "N"},
        format="json",
        **OPT_IN,
    )
    assert resp.status_code == 201
    assert "refresh" not in resp.json() and resp.json()["access"]
    assert resp.cookies[COOKIE]["httponly"] is True


def test_failed_login_sets_no_cookie(user):
    resp = APIClient().post(
        reverse("login"), {"email": "c@example.com", "password": "wrong"}, format="json", **OPT_IN
    )
    assert resp.status_code == 401
    assert COOKIE not in resp.cookies


# ---------------------------------------------------------------------------
# Refreshing
# ---------------------------------------------------------------------------
def test_refresh_from_cookie_rotates_and_never_exposes_the_token(user):
    client = APIClient()
    old = _login(client, **OPT_IN).cookies[COOKIE].value
    resp = client.post(reverse("token-refresh"), {}, format="json", **OPT_IN)
    assert resp.status_code == 200
    assert resp.json()["access"] and "refresh" not in resp.json()
    new = resp.cookies[COOKIE].value
    assert new and new != old


def test_cookie_is_ignored_without_the_opt_in_header(user):
    """CSRF defence in depth: a cookie-authenticated refresh needs the custom header."""
    client = APIClient()
    _login(client, **OPT_IN)
    resp = client.post(reverse("token-refresh"), {}, format="json")  # no header
    assert resp.status_code == 400


def test_rotated_cookie_cannot_be_replayed_and_is_cleared(user):
    client = APIClient()
    old = _login(client, **OPT_IN).cookies[COOKIE].value
    assert client.post(reverse("token-refresh"), {}, format="json", **OPT_IN).status_code == 200

    stale = APIClient()
    stale.cookies[COOKIE] = old
    resp = stale.post(reverse("token-refresh"), {}, format="json", **OPT_IN)
    assert resp.status_code == 401
    assert resp.cookies[COOKIE]["max-age"] == 0  # told the browser to drop it
    assert resp.cookies[COOKIE]["path"] == "/api/auth/"


def test_legacy_body_token_is_migrated_into_the_cookie(user):
    """A refresh token that used to live in localStorage is exchanged once."""
    legacy = _login(APIClient()).json()["refresh"]
    resp = APIClient().post(reverse("token-refresh"), {"refresh": legacy}, format="json", **OPT_IN)
    assert resp.status_code == 200
    assert "refresh" not in resp.json()
    assert resp.cookies[COOKIE].value and resp.cookies[COOKIE]["httponly"] is True


def test_legacy_clients_still_get_the_rotated_token_in_the_body(user):
    legacy = _login(APIClient()).json()["refresh"]
    resp = APIClient().post(reverse("token-refresh"), {"refresh": legacy}, format="json")
    assert resp.status_code == 200
    assert resp.json()["refresh"] and resp.json()["refresh"] != legacy
    assert COOKIE not in resp.cookies


def test_a_bad_body_token_does_not_clear_a_valid_cookie(user):
    client = APIClient()
    _login(client, **OPT_IN)
    resp = client.post(reverse("token-refresh"), {"refresh": "garbage"}, format="json", **OPT_IN)
    assert resp.status_code == 401
    assert COOKIE not in resp.cookies


# ---------------------------------------------------------------------------
# Logout and account deletion
# ---------------------------------------------------------------------------
def test_logout_revokes_the_cookie_token_and_clears_it(user):
    client = APIClient()
    old = _login(client, **OPT_IN).cookies[COOKIE].value
    resp = client.post(reverse("logout"), {}, format="json", **OPT_IN)
    assert resp.status_code == 205
    assert resp.cookies[COOKIE]["max-age"] == 0 and resp.cookies[COOKIE]["path"] == "/api/auth/"

    stale = APIClient()
    stale.cookies[COOKIE] = old
    assert stale.post(reverse("token-refresh"), {}, format="json", **OPT_IN).status_code == 401


def test_logout_without_any_token_is_ok_only_for_opted_in_clients(user):
    assert APIClient().post(reverse("logout"), {}, format="json").status_code == 400
    assert APIClient().post(reverse("logout"), {}, format="json", **OPT_IN).status_code == 205


def test_account_deletion_clears_the_cookie_and_revokes_the_token(user):
    client = APIClient()
    tokens = _login(client, **OPT_IN)
    old = tokens.cookies[COOKIE].value
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.json()['access']}")
    resp = client.post(reverse("me-delete"), {"password": PASSWORD}, format="json")
    assert resp.status_code == 204
    assert resp.cookies[COOKIE]["max-age"] == 0 and resp.cookies[COOKIE]["path"] == "/api/auth/"

    # A browser would have dropped the cookie; replay the old value as an attacker would.
    stale = APIClient()
    stale.cookies[COOKIE] = old
    assert stale.post(reverse("token-refresh"), {}, format="json", **OPT_IN).status_code == 401


# ---------------------------------------------------------------------------
# CORS: credentialed cross-origin requests are not allowed (cookie is first-party only)
# ---------------------------------------------------------------------------
def test_cors_does_not_allow_credentials():
    resp = APIClient().options(
        reverse("login"),
        HTTP_ORIGIN="https://evil.vercel.app",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
    )
    assert "access-control-allow-credentials" not in {k.lower() for k in resp.headers}
