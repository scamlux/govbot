"""Stage 2 — Click SHOP API (prepare/complete)."""
import hashlib
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import Order, Plan, Subscription

pytestmark = pytest.mark.django_db
SECRET = "click-secret"
SERVICE = "4242"


@pytest.fixture(autouse=True)
def _env(settings):
    cache.clear()
    settings.CLICK_SERVICE_ID = SERVICE
    settings.CLICK_SECRET_KEY = SECRET
    settings.CLICK_MERCHANT_ID = "99"
    settings.CLICK_MERCHANT_USER_ID = ""
    call_command("seed_plans")
    Plan.objects.filter(code="plus").update(price_uzs=50000)


@pytest.fixture
def order():
    user = User.objects.create_user(email="c@example.com", password="pw-123-strong")
    plan = Plan.objects.get(code="plus")
    return Order.objects.create(user=user, plan=plan, amount_tiyin=plan.price_tiyin)


def _payload(order, complete=False, prepare_id=None, amount="50000", action=None, trans="1001", **extra):
    action = action if action is not None else ("1" if complete else "0")
    d = {"click_trans_id": trans, "service_id": SERVICE, "click_paydoc_id": "555",
         "merchant_trans_id": str(order.pk), "amount": amount, "action": action,
         "error": "0", "error_note": "Success", "sign_time": "2026-11-10 12:00:00", **extra}
    parts = [d["click_trans_id"], d["service_id"], SECRET, d["merchant_trans_id"]]
    if complete:
        d["merchant_prepare_id"] = str(prepare_id)
        parts.append(d["merchant_prepare_id"])
    parts += [d["amount"], d["action"], d["sign_time"]]
    d["sign_string"] = hashlib.md5("".join(parts).encode()).hexdigest()
    return d


def post(name, data):
    return APIClient().post(reverse(name), data)  # form-encoded, like Click


def prepare(order, **kw):
    return post("billing-click-prepare", _payload(order, **kw)).json()


def complete(order, prepare_id, **kw):
    return post("billing-click-complete", _payload(order, complete=True, prepare_id=prepare_id, **kw)).json()


def test_404_when_env_unset(settings):
    settings.CLICK_SECRET_KEY = ""
    assert APIClient().post(reverse("billing-click-prepare"), {}).status_code == 404
    settings.CLICK_SECRET_KEY, settings.CLICK_SERVICE_ID = SECRET, ""
    assert APIClient().post(reverse("billing-click-complete"), {}).status_code == 404


def test_bad_sign(order):
    data = _payload(order)
    data["sign_string"] = "0" * 32
    assert post("billing-click-prepare", data).json()["error"] == -1
    data = _payload(order)
    del data["sign_time"]
    assert post("billing-click-prepare", data).json()["error"] == -8


def test_prepare_errors(order):
    assert prepare(order, amount="49999")["error"] == -2
    assert prepare(order, action="1")["error"] == -3
    ghost = Order(pk=424242)
    assert prepare(ghost)["error"] == -5


def test_happy_path_and_duplicate_complete(order):
    p = prepare(order)
    assert p["error"] == 0 and p["merchant_prepare_id"]
    assert prepare(order)["merchant_prepare_id"] == p["merchant_prepare_id"]  # retry-safe
    c = complete(order, p["merchant_prepare_id"])
    assert c["error"] == 0 and c["merchant_confirm_id"]
    sub = Subscription.objects.get(user=order.user)
    assert sub.plan.code == "plus" and sub.provider == "click"
    assert abs((sub.current_period_end - timezone.now()) - timedelta(days=30)) < timedelta(minutes=1)
    order.refresh_from_db()
    assert order.status == Order.PAID
    assert complete(order, p["merchant_prepare_id"])["error"] == -4  # duplicate
    assert prepare(order)["error"] == -4
    assert Subscription.objects.count() == 1


def test_complete_errors(order):
    p = prepare(order)
    assert complete(order, 999999)["error"] == -6
    assert complete(order, p["merchant_prepare_id"], amount="1")["error"] == -2
    assert complete(order, p["merchant_prepare_id"], trans="2002")["error"] == -6  # unknown click txn


def test_click_reported_error_cancels(order):
    p = prepare(order)
    c = complete(order, p["merchant_prepare_id"], error="-5017")
    assert c["error"] == -9
    assert not Subscription.objects.exists()
    assert complete(order, p["merchant_prepare_id"])["error"] == -9


def test_checkout_click_url(order):
    client = APIClient()
    client.force_authenticate(user=order.user)
    resp = client.post(reverse("billing-checkout"), {"plan": "plus", "provider": "click"}, format="json")
    assert resp.status_code == 201
    url = resp.json()["url"]
    new = resp.json()["order_id"]
    assert url.startswith("https://my.click.uz/services/pay?")
    assert f"service_id={SERVICE}" in url and "merchant_id=99" in url
    assert "amount=50000.00" in url and f"transaction_param={new}" in url
