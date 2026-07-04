"""
Django settings for the GovBot project.

Configuration is read from environment variables (see backend/.env.example).
A local SQLite fallback is used when no Postgres/DATABASE_URL config is present, so the
backend runs instantly in development.
"""
from datetime import timedelta
from pathlib import Path

import sys

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

INSECURE_SECRET_KEY = "django-insecure-dev-only-change-me"


def require_secure_secret_key(debug: bool, secret_key: str) -> None:
    """S1 — refuse to run production on an insecure signing key.

    A guessable ``SECRET_KEY`` under ``DEBUG=False`` means forgeable JWTs and tamperable
    sessions, so we fail loudly at import rather than boot. We reject the empty string and
    **any** key carrying Django's ``django-insecure-`` marker prefix — this covers our own
    settings default, the different default baked into ``docker-compose.yml``, and any key
    left over from ``django-admin startproject``. In ``DEBUG`` these are fine for instant
    local dev. Kept as a pure function so the rule is unit-testable.
    """
    if not debug and (not secret_key or secret_key.startswith("django-insecure-")):
        raise ImproperlyConfigured(
            "SECRET_KEY is unset or an insecure development default (empty or "
            "'django-insecure-…') while DEBUG=False. Set a strong, unique SECRET_KEY in "
            "the environment before deploying."
        )

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
)

# Load backend/.env if present (does not override real environment variables).
environ.Env.read_env(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = env("SECRET_KEY", default=INSECURE_SECRET_KEY)
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# Enforce the S1 guard on a real boot. Skipped under pytest, which sets up Django before
# the test env is fully applied — the rule itself is covered by tests/test_settings.py.
if "pytest" not in sys.modules:
    require_secure_secret_key(DEBUG, SECRET_KEY)

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "rest_framework",
    "corsheaders",
    # local
    "accounts",
    "scenarios",
    "chat",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Priority: DATABASE_URL -> discrete POSTGRES_* vars -> local SQLite fallback.
if env("DATABASE_URL", default=None):
    DATABASES = {"default": env.db("DATABASE_URL")}
elif env("POSTGRES_DB", default=None):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB"),
            "USER": env("POSTGRES_USER", default="postgres"),
            "PASSWORD": env("POSTGRES_PASSWORD", default=""),
            "HOST": env("POSTGRES_HOST", default="localhost"),
            "PORT": env("POSTGRES_PORT", default="5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Reuse Postgres connections across requests instead of opening one per request
# (a cheap latency win under load). Health-check a pooled connection before reuse so a
# stale/closed socket is transparently replaced. Skipped for the sqlite dev fallback.
if DATABASES["default"]["ENGINE"] != "django.db.backends.sqlite3":
    DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=600)
    DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

# ---------------------------------------------------------------------------
# DRF + SimpleJWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    # A1 — throttle scopes are attached per-view (chat endpoints only); rates come
    # from env so ops can tighten limits without a code change.
    "DEFAULT_THROTTLE_RATES": {
        "chat_burst": env("CHAT_THROTTLE_BURST", default="20/min"),
        "chat_sustained": env("CHAT_THROTTLE_SUSTAINED", default="500/day"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("ACCESS_TOKEN_LIFETIME_MIN", default=60)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("REFRESH_TOKEN_LIFETIME_DAYS", default=7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
FRONTEND_ORIGIN = env("FRONTEND_ORIGIN", default="http://localhost:5173")
CORS_ALLOWED_ORIGINS = list(
    {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        FRONTEND_ORIGIN,
    }
)
CORS_ALLOW_CREDENTIALS = True

# Trusted origins for unsafe (POST) requests to Django admin behind a proxy.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_ORIGIN])

# Respect the X-Forwarded-Proto header set by the nginx reverse proxy / PaaS load balancer.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# On Railway the public hostname is injected as RAILWAY_PUBLIC_DOMAIN. Auto-trust it so a
# deploy needs no manual ALLOWED_HOSTS/CSRF wiring (the domain isn't known until deploy).
_railway_domain = env("RAILWAY_PUBLIC_DOMAIN", default="")
if _railway_domain:
    ALLOWED_HOSTS = list({*ALLOWED_HOSTS, _railway_domain})
    CSRF_TRUSTED_ORIGINS = list({*CSRF_TRUSTED_ORIGINS, f"https://{_railway_domain}"})

# Same idea for Render, which injects the service hostname as RENDER_EXTERNAL_HOSTNAME.
_render_host = env("RENDER_EXTERNAL_HOSTNAME", default="")
if _render_host:
    ALLOWED_HOSTS = list({*ALLOWED_HOSTS, _render_host})
    CSRF_TRUSTED_ORIGINS = list({*CSRF_TRUSTED_ORIGINS, f"https://{_render_host}"})

# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
OPENAI_MODEL = env("OPENAI_MODEL", default="gpt-4o-mini")
# Embedding model used for RAG grounding of chat answers against the Scenario Catalog.
OPENAI_EMBEDDING_MODEL = env("OPENAI_EMBEDDING_MODEL", default="text-embedding-3-small")
OPENAI_MAX_TOKENS = env.int("OPENAI_MAX_TOKENS", default=1200)
OPENAI_TEMPERATURE = env.float("OPENAI_TEMPERATURE", default=0.3)

# ---------------------------------------------------------------------------
# Chat input hardening (S3) + RAG retrieval knobs (B4)
# ---------------------------------------------------------------------------
# Max characters accepted for a single chat message (server-enforced; the UI mirrors it).
CHAT_MAX_MESSAGE_CHARS = env.int("CHAT_MAX_MESSAGE_CHARS", default=4000)
# Retrieval tunables: how many grounding snippets to inject and the cosine floor below
# which a scenario is treated as irrelevant.
RETRIEVAL_TOP_K = env.int("RETRIEVAL_TOP_K", default=3)
RETRIEVAL_MIN_SCORE = env.float("RETRIEVAL_MIN_SCORE", default=0.28)

# ---------------------------------------------------------------------------
# i18n / tz
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Production security hardening (only when DEBUG is off, so local dev over http
# is never forced onto https). All individually overridable via env.
# ---------------------------------------------------------------------------
if not DEBUG and "pytest" not in sys.modules:
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 365)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ---------------------------------------------------------------------------
# Logging — surface warnings/errors on stdout so they show up in container logs
# (Railway/Docker) instead of being silently swallowed in production.
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "chat": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
