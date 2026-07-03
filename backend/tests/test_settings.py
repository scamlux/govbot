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
