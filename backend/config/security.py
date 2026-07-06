"""Deployment security guards (Backlog S1).

`SECRET_KEY` signs sessions, JWTs and password-reset tokens. Shipping the well-known
development default to production would let anyone forge them, so the settings module
calls `validate_secret_key()` at import time and refuses to boot a non-DEBUG process
with an insecure key.
"""
from django.core.exceptions import ImproperlyConfigured

# The dev fallback baked into settings.py plus the placeholders shipped in the
# .env.example templates — none of these may ever reach production.
INSECURE_SECRET_KEYS = frozenset(
    {
        "django-insecure-dev-only-change-me",
        "change-me-to-a-long-random-string",
    }
)


def validate_secret_key(secret_key: str, debug: bool) -> None:
    """Raise ImproperlyConfigured when DEBUG is off and SECRET_KEY is insecure."""
    if debug:
        return
    if not secret_key or secret_key in INSECURE_SECRET_KEYS:
        raise ImproperlyConfigured(
            "Refusing to start with DEBUG=False and an insecure default SECRET_KEY. "
            "Set the SECRET_KEY environment variable to a long random string, e.g. "
            "generated with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
