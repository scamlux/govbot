"""Per-user rate limiting for the chat message endpoints (Backlog A1).

Every chat message can trigger a paid OpenAI call, so the two message endpoints carry
two per-user budgets: a short burst window (anti-hammering) and a daily cap (cost
ceiling). Rates come from settings/env — see `DEFAULT_THROTTLE_RATES` in
config/settings.py and CHAT_THROTTLE_* in backend/.env.example.
"""
from rest_framework.exceptions import Throttled
from rest_framework.throttling import UserRateThrottle

from .i18n import THROTTLED_MESSAGE, resolve_language


class ChatBurstRateThrottle(UserRateThrottle):
    """Short-window limit (default 20/min) — scope `chat_burst`."""

    scope = "chat_burst"


class ChatSustainedRateThrottle(UserRateThrottle):
    """Daily budget cap (default 500/day) — scope `chat_sustained`."""

    scope = "chat_sustained"


class LocalizedThrottledMixin:
    """APIView mixin: 429 responses carry a message in the request's language."""

    def throttled(self, request, wait):
        try:
            candidate = request.data.get("language")
        except Exception:  # noqa: BLE001 — unparsable body; fall back to profile language
            candidate = None
        lang = resolve_language(candidate, getattr(request, "user", None))
        # Passing `wait` into Throttled() appends an untranslated English suffix to the
        # detail; set it afterwards instead so the Retry-After header is still emitted.
        exc = Throttled(detail=THROTTLED_MESSAGE[lang])
        exc.wait = wait
        raise exc
