"""Per-user rate limits for the chat endpoints (A1).

Two independent windows are applied together so a single account can neither burst
(hammer the OpenAI API in seconds) nor drain the daily budget over a long session:

* ``ChatBurstThrottle``     — short window, e.g. ``20/min``  (scope ``chat_burst``)
* ``ChatSustainedThrottle`` — long window,  e.g. ``500/day`` (scope ``chat_sustained``)

Rates are configured in ``REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`` from env vars.
Both key on the authenticated user id (the chat endpoints are auth-only), so limits are
per-account rather than per-IP.
"""
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class ChatBurstThrottle(UserRateThrottle):
    scope = "chat_burst"


class ChatSustainedThrottle(UserRateThrottle):
    scope = "chat_sustained"


class GuestBurstThrottle(AnonRateThrottle):
    """B1 — guest chat, per client IP, short window (``GUEST_THROTTLE_BURST``)."""

    scope = "guest_burst"

    def get_cache_key(self, request, view):
        # AnonRateThrottle skips authenticated users; guests and signed-in callers of the
        # guest endpoint are all limited by IP here.
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class GuestSustainedThrottle(GuestBurstThrottle):
    """B1 — guest chat, per client IP, daily window (``GUEST_THROTTLE_SUSTAINED``)."""

    scope = "guest_sustained"


class TelegramChatThrottle(SimpleRateThrottle):
    """D1 — per Telegram chat id, so one chat cannot drain the budget."""

    scope = "telegram"

    def get_cache_key(self, request, view):
        chat_id = getattr(request, "telegram_chat_id", None)
        if chat_id is None:
            return None
        return self.cache_format % {"scope": self.scope, "ident": chat_id}
