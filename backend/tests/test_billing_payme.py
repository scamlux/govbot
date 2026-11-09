"""Stage 2 — Payme Merchant API (JSON-RPC) + checkout."""
import base64
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import Order, PaymentTransaction, Plan, Subscription

pytestmark = pytest.mark.django_db
KEY = "payme-secret-key-for-tests"
URL_NAME = "billing-payme"


@pytest.fixture(autouse=True)
def _env(settings):
    cache.clear()
    settings.PAYME_MERCHANT_KEY = KEY
    settings.PAYME_TEST_KEY = "test-key"
    settings.PAYME_MERCHANT_ID = "merchant123"
    settings.PAYME_CHECKOUT_URL = ""
    call_command("seed_plans")
    Plan.objects.filter(code="plus").update(price_uzs=50000, period_days=30)


@pytest.fixture
def order():
    user = User.objects.create_user(email="p@example.com", password="pw-123-strong")
    plan = Plan.objects.get(code="plus")
    return Order.objects.create(user=user, plan=plan, amount_tiyin=plan.price_tiyin)


def _auth(key=KEY, login="Paycom"):
    return "Basic " + base64.b64encode(f"{login}:{key}".encode()).decode()


def rpc(method, params, key=KEY, **kw):
    return APIClient().post(
        reverse(URL_NAME), {"method": method, "params": params, "id": 7}, format="json",
        HTTP_AUTHORIZATION=_auth(key), **kw,
    ).json()


def _create(order, txid="a" * 24, amount=None, t=1_700_000_000_000):
    return rpc("CreateTransaction", {
        "id": txid, "time": t, "amount": amount or order.amount_tiyin,
        "account": {"order_id": order.pk},
    })


def test_404_when_key_unset(settings):
    settings.PAYME_MERCHANT_KEY = ""
    assert APIClient().post(reverse(URL_NAME), {}, format="json").status_code == 404


def test_wrong_or_missing_auth_is_32504(order):
    assert rpc("CheckTransaction", {"id": "x"}, key="wrong")["error"]["code"] == -32504
    assert rpc("CheckTransaction", {"id": "x"}, key=KEY + "x")["error"]["code"] == -32504
    no_auth = APIClient().post(reverse(URL_NAME), {"method": "x", "params": {}}, format="json")
    assert no_auth.status_code == 200 and no_auth.json()["error"]["code"] == -32504


def test_test_key_accepted(order):
    resp = rpc("CheckPerformTransaction", {"amount": order.amount_tiyin,
               "account": {"order_id": order.pk}}, key="test-key")
    assert resp["result"] == {"allow": True}


def test_bad_requests():
    c = APIClient()
    h = {"HTTP_AUTHORIZATION": _auth()}
    assert c.get(reverse(URL_NAME), **h).json()["error"]["code"] == -32300
    assert c.post(reverse(URL_NAME), "{not json", content_type="text/json", **h).json()["error"]["code"] == -32700
    assert c.post(reverse(URL_NAME), {"method": "CheckTransaction"}, format="json", **h).json()["error"]["code"] == -32600
    r = c.post(reverse(URL_NAME), {"method": "Nope", "params": {}, "id": 1}, format="json", **h).json()
    assert r["error"]["code"] == -32601 and r["error"]["data"] == "Nope"


def test_check_perform_wrong_amount_and_unknown_order(order):
    r = rpc("CheckPerformTransaction", {"amount": order.amount_tiyin + 1, "account": {"order_id": order.pk}})
    assert r["error"]["code"] == -31001
    r = rpc("CheckPerformTransaction", {"amount": 1, "account": {"order_id": 999999}})
    assert r["error"]["code"] == -31050 and r["error"]["data"] == "order_id"
    r = rpc("CheckPerformTransaction", {"amount": 1, "account": {"order_id": "abc"}})
    assert r["error"]["code"] == -31050
    assert set(r["error"]["message"]) == {"uz", "ru", "en"}


def test_full_flow_activates_subscription_and_is_idempotent(order):
    created = _create(order)["result"]
    assert created["state"] == 1
    assert _create(order)["result"]["transaction"] == created["transaction"]  # replay
    done = rpc("PerformTransaction", {"id": "a" * 24})["result"]
    assert done["state"] == 2 and done["perform_time"] > 0
    again = rpc("PerformTransaction", {"id": "a" * 24})["result"]
    assert again["perform_time"] == done["perform_time"]
    sub = Subscription.objects.get(user=order.user)
    assert sub.plan.code == "plus" and sub.status == "active" and sub.provider == "payme"
    assert abs((sub.current_period_end - timezone.now()) - timedelta(days=30)) < timedelta(minutes=1)
    assert Subscription.objects.count() == 1
    order.refresh_from_db()
    assert order.status == Order.PAID
    # Paid order can no longer be paid again.
    r = rpc("CheckPerformTransaction", {"amount": order.amount_tiyin, "account": {"order_id": order.pk}})
    assert r["error"]["code"] == -31050


def test_create_validations(order):
    assert _create(order, amount=order.amount_tiyin + 5)["error"]["code"] == -31001
    _create(order, txid="a" * 24)
    # A second transaction for an order that already has a pending one is refused.
    assert _create(order, txid="b" * 24)["error"]["code"] == -31099
    assert PaymentTransaction.objects.count() == 1


def test_perform_unknown_and_wrong_state(order):
    assert rpc("PerformTransaction", {"id": "z" * 24})["error"]["code"] == -31003
    _create(order)
    rpc("CancelTransaction", {"id": "a" * 24, "reason": 3})
    assert rpc("PerformTransaction", {"id": "a" * 24})["error"]["code"] == -31008


def test_timeout_cancels_with_reason_4(order):
    _create(order)
    PaymentTransaction.objects.update(create_time=timezone.now() - timedelta(hours=12, minutes=1))
    assert rpc("PerformTransaction", {"id": "a" * 24})["error"]["code"] == -31008
    tx = PaymentTransaction.objects.get()
    assert tx.state == -1 and tx.reason == 4  # persisted despite the error reply
    assert not Subscription.objects.exists()


def test_cancel_before_and_after_perform(order):
    _create(order)
    r = rpc("CancelTransaction", {"id": "a" * 24, "reason": 2})["result"]
    assert r["state"] == -1 and r["cancel_time"] > 0
    assert rpc("CancelTransaction", {"id": "a" * 24, "reason": 2})["result"]["state"] == -1  # idempotent
    assert not Subscription.objects.exists()

    order2 = Order.objects.create(user=order.user, plan=order.plan, amount_tiyin=order.amount_tiyin)
    _create(order2, txid="c" * 24)
    rpc("PerformTransaction", {"id": "c" * 24})
    assert Subscription.objects.get().status == "active"
    r = rpc("CancelTransaction", {"id": "c" * 24, "reason": 5})["result"]
    assert r["state"] == -2
    assert Subscription.objects.get().status == "cancelled"
    assert rpc("CancelTransaction", {"id": "zz" + "c" * 22})["error"]["code"] == -31003


def test_check_transaction(order):
    assert rpc("CheckTransaction", {"id": "a" * 24})["error"]["code"] == -31003
    _create(order)
    r = rpc("CheckTransaction", {"id": "a" * 24})["result"]
    assert r["state"] == 1 and r["perform_time"] == 0 and r["cancel_time"] == 0 and r["reason"] is None
    rpc("CancelTransaction", {"id": "a" * 24, "reason": 3})
    assert rpc("CheckTransaction", {"id": "a" * 24})["result"]["reason"] == 3


def test_get_statement_filters_by_payme_time(order):
    _create(order, t=1_700_000_000_000)
    inside = rpc("GetStatement", {"from": 1_699_999_999_000, "to": 1_700_000_001_000})["result"]["transactions"]
    assert len(inside) == 1
    row = inside[0]
    assert row["id"] == "a" * 24 and row["amount"] == order.amount_tiyin and row["state"] == 1
    assert row["account"] == {"order_id": order.pk}
    assert rpc("GetStatement", {"from": 1, "to": 2})["result"]["transactions"] == []


def test_extending_existing_subscription_adds_period(order):
    _create(order)
    rpc("PerformTransaction", {"id": "a" * 24})
    order2 = Order.objects.create(user=order.user, plan=order.plan, amount_tiyin=order.amount_tiyin)
    _create(order2, txid="d" * 24)
    rpc("PerformTransaction", {"id": "d" * 24})
    sub = Subscription.objects.get()
    assert abs((sub.current_period_end - timezone.now()) - timedelta(days=60)) < timedelta(minutes=1)


# ---- checkout ---------------------------------------------------------------
def _checkout(user, **body):
    c = APIClient()
    c.force_authenticate(user=user)
    return c.post(reverse("billing-checkout"), body, format="json")


def test_checkout_payme_url(order, settings):
    resp = _checkout(order.user, plan="plus", provider="payme", lang="ru")
    assert resp.status_code == 201
    body = resp.json()
    prefix = "https://checkout.paycom.uz/"
    assert body["url"].startswith(prefix)
    raw = base64.b64decode(body["url"][len(prefix):]).decode()
    new = Order.objects.get(pk=body["order_id"])
    assert raw == f"m=merchant123;ac.order_id={new.pk};a=5000000;l=ru"
    assert new.amount_tiyin == 5_000_000 and new.status == "pending"
    settings.PAYME_CHECKOUT_URL = "https://test.paycom.uz/"
    assert _checkout(order.user, plan="plus", provider="payme").json()["url"].startswith("https://test.paycom.uz/")


def test_checkout_rejections(order, settings):
    assert _checkout(order.user, plan="free", provider="payme").status_code == 400  # not for sale
    assert _checkout(order.user, plan="nope", provider="payme").status_code == 400
    assert _checkout(order.user, plan="plus", provider="click").status_code == 400  # unconfigured
    settings.PAYME_MERCHANT_KEY = ""
    r = _checkout(order.user, plan="plus", provider="payme")
    assert r.status_code == 400 and r.json()["code"] == "billing_disabled"
    assert APIClient().post(reverse("billing-checkout"), {}, format="json").status_code == 401
