"""Checkout URL builders (the user is redirected to the provider's hosted payment page)."""
import base64
from urllib.parse import urlencode

from django.conf import settings

PAYME_DEFAULT_CHECKOUT = "https://checkout.paycom.uz"
CLICK_PAY_URL = "https://my.click.uz/services/pay"
PAYME_LANGS = {"uz", "ru", "en"}


def payme_url(order, lang: str) -> str:
    lang = lang if lang in PAYME_LANGS else "uz"
    raw = f"m={settings.PAYME_MERCHANT_ID};ac.order_id={order.pk};a={order.amount_tiyin};l={lang}"
    base = (settings.PAYME_CHECKOUT_URL or PAYME_DEFAULT_CHECKOUT).rstrip("/")
    return f"{base}/{base64.b64encode(raw.encode()).decode()}"


def click_url(order) -> str:
    params = {
        "service_id": settings.CLICK_SERVICE_ID,
        "merchant_id": settings.CLICK_MERCHANT_ID,
        "amount": f"{order.amount_tiyin / 100:.2f}",
        "transaction_param": order.pk,
        "return_url": f"{settings.FRONTEND_ORIGIN}/",
    }
    if settings.CLICK_MERCHANT_USER_ID:
        params["merchant_user_id"] = settings.CLICK_MERCHANT_USER_ID
    return f"{CLICK_PAY_URL}?{urlencode(params)}"
