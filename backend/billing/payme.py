"""Payme Merchant API (JSON-RPC 2.0) — ``POST /api/billing/payme/``.

Spec: https://developer.help.paycom.uz/metody-merchant-api/ (read while implementing).
``account`` = ``{"order_id": <Order.pk>}``; amounts in tiyin; timestamps in ms. Every reply is
HTTP 200 (errors travel in the JSON body). Transaction states: 1 created, 2 performed,
-1 cancelled, -2 cancelled after perform. Unpaid transactions time out after 12 h.
"""
import base64
import hmac
import json
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .config import payme_webhook_enabled
from .models import Order, PaymentTransaction
from .services import to_ms
from .throttles import WebhookThrottle

TIMEOUT = timedelta(hours=12)
REASON_TIMEOUT = 4

MSG = {
    -32300: "Method must be POST",
    -32700: "JSON parse error",
    -32600: "Invalid request",
    -32601: "Method not found",
    -32504: "Insufficient privileges",
    -32400: "Internal error",
    -31001: "Wrong amount",
    -31003: "Transaction not found",
    -31007: "Cannot cancel transaction",
    -31008: "Cannot perform operation",
    -31050: "Order not found",
    -31099: "Order is busy",
}


class RpcError(Exception):
    def __init__(self, code, data=None):
        self.code, self.data = code, data


def _message(code):
    text = MSG.get(code, "Error")
    return {"uz": text, "ru": text, "en": text}


def _authorized(request) -> bool:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "basic" or not token:
        return False
    try:
        login, _, password = base64.b64decode(token).decode().partition(":")
    except Exception:
        return False
    keys = [k for k in (settings.PAYME_MERCHANT_KEY, settings.PAYME_TEST_KEY) if k]
    # Constant-time compare against every configured key (no early exit on the login check).
    ok_key = any(hmac.compare_digest(password.encode(), k.encode()) for k in keys)
    return bool(login == "Paycom") & ok_key


def _order_for(params, *, amount_check=True) -> Order:
    account = params.get("account")
    if not isinstance(account, dict):
        raise RpcError(-32600)
    try:
        order = Order.objects.select_for_update().get(pk=int(account.get("order_id")))
    except (TypeError, ValueError, Order.DoesNotExist):
        raise RpcError(-31050, "order_id")
    if order.status != Order.PENDING:
        raise RpcError(-31050, "order_id")
    if amount_check:
        amount = params.get("amount")
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise RpcError(-32600)
        if amount != order.amount_tiyin:
            raise RpcError(-31001, "amount")
    return order


def _timed_out(tx) -> bool:
    return timezone.now() - tx.create_time > TIMEOUT


def _get_tx(params, lock=True) -> PaymentTransaction:
    txid = params.get("id")
    if not isinstance(txid, str):
        raise RpcError(-32600)
    qs = PaymentTransaction.objects.filter(provider="payme", provider_txn_id=txid)
    tx = (qs.select_for_update() if lock else qs).select_related("plan", "user").first()
    if not tx:
        raise RpcError(-31003)
    return tx


def _tx_result(tx, *keys):
    full = {
        "create_time": to_ms(tx.create_time),
        "perform_time": to_ms(tx.perform_time),
        "cancel_time": to_ms(tx.cancel_time),
        "transaction": str(tx.pk),
        "state": tx.state,
        "reason": tx.reason,
    }
    return {k: full[k] for k in keys}


def check_perform(params):
    _order_for(params)
    return {"allow": True}


def create(params):
    txid = params.get("id")
    if not isinstance(txid, str) or not isinstance(params.get("time"), int):
        raise RpcError(-32600)
    existing = (
        PaymentTransaction.objects.select_for_update()
        .filter(provider="payme", provider_txn_id=txid).select_related("plan", "user").first()
    )
    if existing:
        if existing.state != PaymentTransaction.CREATED:
            raise RpcError(-31008)
        if _timed_out(existing):
            services.cancel_transaction(existing, REASON_TIMEOUT)
            raise RpcError(-31008)
        return _tx_result(existing, "create_time", "transaction", "state")
    order = _order_for(params)
    busy = PaymentTransaction.objects.filter(
        order=order, state=PaymentTransaction.CREATED,
        create_time__gt=timezone.now() - TIMEOUT,
    ).exists()
    if busy:
        raise RpcError(-31099, "order_id")
    tx = PaymentTransaction.objects.create(
        provider="payme", provider_txn_id=txid, user=order.user, plan=order.plan, order=order,
        amount_tiyin=order.amount_tiyin, payload={"time": params["time"]},
    )
    return _tx_result(tx, "create_time", "transaction", "state")


def perform(params):
    tx = _get_tx(params)
    if tx.state == PaymentTransaction.PERFORMED:
        return _tx_result(tx, "transaction", "perform_time", "state")
    if tx.state != PaymentTransaction.CREATED:
        raise RpcError(-31008)
    if _timed_out(tx):
        services.cancel_transaction(tx, REASON_TIMEOUT)
        raise RpcError(-31008)
    services.perform_transaction(tx)
    return _tx_result(tx, "transaction", "perform_time", "state")


def cancel(params):
    tx = _get_tx(params)
    if tx.state in (PaymentTransaction.CREATED, PaymentTransaction.PERFORMED):
        reason = params.get("reason")
        services.cancel_transaction(tx, reason if isinstance(reason, int) else None)
    return _tx_result(tx, "transaction", "cancel_time", "state")


def check(params):
    return _tx_result(_get_tx(params, lock=False), "create_time", "perform_time",
                      "cancel_time", "transaction", "state", "reason")


def statement(params):
    start, end = params.get("from"), params.get("to")
    if not isinstance(start, int) or not isinstance(end, int):
        raise RpcError(-32600)
    rows = []
    for tx in PaymentTransaction.objects.filter(provider="payme").order_by("id"):
        paycom_time = int(tx.payload.get("time", 0))
        if start <= paycom_time <= end:
            rows.append({
                "id": tx.provider_txn_id, "time": paycom_time, "amount": tx.amount_tiyin,
                "account": {"order_id": tx.order_id},
                **_tx_result(tx, "create_time", "perform_time", "cancel_time", "transaction",
                             "state", "reason"),
            })
    return {"transactions": rows}


METHODS = {
    "CheckPerformTransaction": check_perform,
    "CreateTransaction": create,
    "PerformTransaction": perform,
    "CancelTransaction": cancel,
    "CheckTransaction": check,
    "GetStatement": statement,
}


class PaymeView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [WebhookThrottle]

    def initial(self, request, *args, **kwargs):
        if not payme_webhook_enabled():
            raise Http404
        super().initial(request, *args, **kwargs)

    def http_method_not_allowed(self, request, *args, **kwargs):
        return _error(-32300, None, None)

    def post(self, request):
        if not _authorized(request):
            return _error(-32504, None, _safe_id(request))
        try:
            body = json.loads(request.body or b"")
        except ValueError:
            return _error(-32700, None, None)
        if not isinstance(body, dict):
            return _error(-32600, None, None)
        rid = body.get("id")
        method, params = body.get("method"), body.get("params")
        if not isinstance(method, str) or not isinstance(params, dict):
            return _error(-32600, None, rid)
        if method not in METHODS:
            return _error(-32601, method, rid)
        handler = METHODS[method]
        failure = None
        with transaction.atomic():
            try:
                result = handler(params)
            except RpcError as exc:
                # Caught INSIDE the atomic block on purpose: a handler may have persisted a
                # state change (timeout cancel) before failing, and that must be committed.
                failure = exc
        if failure:
            return _error(failure.code, failure.data, rid)
        return Response({"jsonrpc": "2.0", "id": rid, "result": result})


def _safe_id(request):
    try:
        value = json.loads(request.body or b"").get("id")
    except (ValueError, AttributeError):
        return None
    return value


def _error(code, data, rid):
    return Response({
        "jsonrpc": "2.0", "id": rid,
        "error": {"code": code, "message": _message(code), "data": data},
    })
