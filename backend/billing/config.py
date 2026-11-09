"""Which payment providers are configured. Everything here is False until env vars are set."""
from django.conf import settings

from .models import Plan


def _s(name: str) -> str:
    return str(getattr(settings, name, "") or "")


def payme_webhook_enabled() -> bool:
    return bool(_s("PAYME_MERCHANT_KEY"))


def click_webhook_enabled() -> bool:
    return bool(_s("CLICK_SERVICE_ID") and _s("CLICK_SECRET_KEY"))


def payme_checkout_enabled() -> bool:
    return payme_webhook_enabled() and bool(_s("PAYME_MERCHANT_ID"))


def click_checkout_enabled() -> bool:
    return click_webhook_enabled() and bool(_s("CLICK_MERCHANT_ID"))


def checkout_providers() -> list[str]:
    out = []
    if payme_checkout_enabled():
        out.append("payme")
    if click_checkout_enabled():
        out.append("click")
    return out


def billing_enabled() -> bool:
    """True only when a plan is for sale AND a provider can actually take payment."""
    return bool(checkout_providers()) and Plan.objects.filter(
        is_active=True, price_uzs__gt=0
    ).exists()
