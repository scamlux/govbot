"""S1 — the production SECRET_KEY guard."""
import pytest
from django.core.exceptions import ImproperlyConfigured

from config.settings import INSECURE_SECRET_KEY, require_secure_secret_key


def test_insecure_key_rejected_when_not_debug():
    with pytest.raises(ImproperlyConfigured):
        require_secure_secret_key(debug=False, secret_key=INSECURE_SECRET_KEY)


def test_docker_compose_default_key_rejected_when_not_debug():
    # docker-compose.yml injects this different insecure default; the guard must catch it.
    with pytest.raises(ImproperlyConfigured):
        require_secure_secret_key(debug=False, secret_key="django-insecure-dev-change-me")


def test_empty_key_rejected_when_not_debug():
    with pytest.raises(ImproperlyConfigured):
        require_secure_secret_key(debug=False, secret_key="")


def test_insecure_key_allowed_in_debug():
    # Development convenience: the shared default is fine while DEBUG is on.
    require_secure_secret_key(debug=True, secret_key=INSECURE_SECRET_KEY)


def test_strong_key_allowed_in_production():
    require_secure_secret_key(debug=False, secret_key="a-real-long-random-production-key")


# --- CORS: the deployed Vercel SPA must be allowed to read the API (the "scenarios
#     don't load" class of bug is a missing Access-Control-Allow-Origin header). ---

def _acao_for(client, origin):
    """Return the Access-Control-Allow-Origin header the API sends back for `origin`."""
    resp = client.get(
        "/api/scenarios/categories/", HTTP_ORIGIN=origin, secure=True
    )
    return resp.headers.get("Access-Control-Allow-Origin")


@pytest.mark.django_db
def test_vercel_origin_is_cors_allowed(client):
    origin = "https://govbot-web.vercel.app"
    assert _acao_for(client, origin) == origin


@pytest.mark.django_db
def test_vercel_preview_subdomain_is_cors_allowed(client):
    origin = "https://govbot-web-git-feature-team.vercel.app"
    assert _acao_for(client, origin) == origin


@pytest.mark.django_db
def test_unknown_origin_is_not_cors_allowed(client):
    assert _acao_for(client, "https://evil.example.com") is None
