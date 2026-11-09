from rest_framework.throttling import SimpleRateThrottle


class WebhookThrottle(SimpleRateThrottle):
    """Generous per-IP ceiling for provider callbacks (``BILLING_WEBHOOK_THROTTLE``).

    Provider servers retry aggressively, so this only guards against floods, not normal load.
    """

    scope = "billing_webhook"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
