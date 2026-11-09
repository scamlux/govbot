"""Click SHOP API — ``POST /api/billing/click/prepare/`` and ``/complete/``.

Sign: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id
          [+ merchant_prepare_id on complete] + amount + action + sign_time).
``merchant_trans_id`` = Order.pk, amounts are in soums (decimal), the transaction row stores
tiyin. Error codes: 0 ok, -1 sign check failed, -2 incorrect amount, -3 action not found,
-4 already paid, -5 order not found, -6 transaction not found, -8 request error, -9 cancelled.
"""
import hashlib
import hmac
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.http import Http404
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .config import click_webhook_enabled
from .models import Order, PaymentTransaction
from .throttles import WebhookThrottle

NOTES = {
    0: "Success", -1: "SIGN CHECK FAILED!", -2: "Incorrect parameter amount",
    -3: "Action not found", -4: "Already paid", -5: "Order not found",
    -6: "Transaction not found", -8: "Error in request from click", -9: "Transaction cancelled",
}
REQUIRED = ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time",
            "sign_string"]
KEPT_PAYLOAD = ["click_trans_id", "click_paydoc_id", "service_id", "sign_time", "action"]


def _sign(data, action_complete: bool) -> str:
    parts = [data["click_trans_id"], data["service_id"], settings.CLICK_SECRET_KEY,
             data["merchant_trans_id"]]
    if action_complete:
        parts.append(data.get("merchant_prepare_id", ""))
    parts += [data["amount"], data["action"], data["sign_time"]]
    return hashlib.md5("".join(str(p) for p in parts).encode()).hexdigest()


def _reply(data, code, **extra):
    body = {"click_trans_id": data.get("click_trans_id"),
            "merchant_trans_id": data.get("merchant_trans_id"), **extra,
            "error": code, "error_note": NOTES.get(code, "Error")}
    return Response(body)


def _amount_ok(data, order) -> bool:
    try:
        return Decimal(str(data["amount"])) * 100 == Decimal(order.amount_tiyin)
    except (InvalidOperation, KeyError):
        return False


def _handle(data, *, complete: bool):
    if any(not str(data.get(k, "")).strip() for k in REQUIRED + (["merchant_prepare_id"] if complete else [])):
        return _reply(data, -8)
    if str(data["service_id"]) != str(settings.CLICK_SERVICE_ID):
        return _reply(data, -8)
    if not hmac.compare_digest(str(data["sign_string"]), _sign(data, complete)):
        return _reply(data, -1)
    if str(data["action"]) != ("1" if complete else "0"):
        return _reply(data, -3)
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=int(data["merchant_trans_id"]))
        except (ValueError, Order.DoesNotExist):
            return _reply(data, -5)
        tx = (
            PaymentTransaction.objects.select_for_update()
            .filter(provider="click", provider_txn_id=str(data["click_trans_id"]))
            .select_related("plan", "user").first()
        )
        return _complete(data, order, tx) if complete else _prepare(data, order, tx)


def _prepare(data, order, tx):
    if tx:
        if tx.order_id != order.pk:
            return _reply(data, -8)
        if tx.state == PaymentTransaction.PERFORMED:
            return _reply(data, -4)
        if tx.state != PaymentTransaction.CREATED:
            return _reply(data, -9)
        return _reply(data, 0, merchant_prepare_id=tx.pk)
    if order.status == Order.PAID:
        return _reply(data, -4)
    if order.status == Order.CANCELLED:
        return _reply(data, -9)
    if not _amount_ok(data, order):
        return _reply(data, -2)
    tx = PaymentTransaction.objects.create(
        provider="click", provider_txn_id=str(data["click_trans_id"]), user=order.user,
        plan=order.plan, order=order, amount_tiyin=order.amount_tiyin,
        payload={k: str(data[k]) for k in KEPT_PAYLOAD if k in data},
    )
    return _reply(data, 0, merchant_prepare_id=tx.pk)


def _complete(data, order, tx):
    if not tx or str(tx.pk) != str(data["merchant_prepare_id"]):
        return _reply(data, -6)
    if tx.order_id != order.pk:
        return _reply(data, -5)
    if tx.state == PaymentTransaction.PERFORMED:
        return _reply(data, -4, merchant_confirm_id=tx.pk)
    if tx.state != PaymentTransaction.CREATED:
        return _reply(data, -9)
    if not _amount_ok(data, order):
        return _reply(data, -2)
    try:
        click_error = int(data.get("error", 0))
    except (TypeError, ValueError):
        click_error = 0
    if click_error < 0:  # Click reports the payment itself failed
        services.cancel_transaction(tx, None)
        return _reply(data, -9)
    services.perform_transaction(tx)
    return _reply(data, 0, merchant_confirm_id=tx.pk)


class _ClickView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [WebhookThrottle]
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    complete = False

    def initial(self, request, *args, **kwargs):
        if not click_webhook_enabled():
            raise Http404
        super().initial(request, *args, **kwargs)

    def post(self, request):
        return _handle(request.data, complete=self.complete)


class ClickPrepareView(_ClickView):
    complete = False


class ClickCompleteView(_ClickView):
    complete = True
