"""Per-user rate limits for the chat endpoints (A1).

Two independent windows are applied together so a single account can neither burst
(hammer the OpenAI API in seconds) nor drain the daily budget over a long session:

* ``ChatBurstThrottle``     — short window, e.g. ``20/min``  (scope ``chat_burst``)
* ``ChatSustainedThrottle`` — long window,  e.g. ``500/day`` (scope ``chat_sustained``)

Rates are configured in ``REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`` from env vars.
Both key on the authenticated user id (the chat endpoints are auth-only), so limits are
per-account rather than per-IP.
"""
from rest_framework.throttling import UserRateThrottle


class ChatBurstThrottle(UserRateThrottle):
    scope = "chat_burst"


class ChatSustainedThrottle(UserRateThrottle):
    scope = "chat_sustained"
