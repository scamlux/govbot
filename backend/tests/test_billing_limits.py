"""Stage 2 — plans, usage limits and the public billing read API."""
import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import Plan, Subscription
from billing.services import active_plan_for
from chat.models import Conversation, Message

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def seeded():
    call_command("seed_plans")


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def user():
    return User.objects.create_user(email="b@example.com", full_name="B", password="pw-123-strong")


def _ask(client, conv, stream=False, lang="en"):
    name = "message-stream" if stream else "message-create"
    return client.post(
        reverse(name, args=[conv.id]), {"content": "How to get a passport?", "language": lang},
        format="json",
    )


def test_seed_plans_creates_unpriced_unlimited_plans_and_is_idempotent(seeded):
    assert set(Plan.objects.values_list("code", flat=True)) == {"free", "plus", "business"}
    assert all(p.price_uzs is None for p in Plan.objects.all())
    assert Plan.objects.get(code="free").daily_question_limit is None
    Plan.objects.filter(code="plus").update(price_uzs=99000)
    call_command("seed_plans")
    assert Plan.objects.get(code="plus").price_uzs == 99000  # owner edits survive


def test_active_plan_falls_back_to_free_then_none(user):
    assert active_plan_for(user) is None
    call_command("seed_plans")
    assert active_plan_for(user).code == "free"
    plus = Plan.objects.get(code="plus")
    Subscription.objects.create(user=user, plan=plus, current_period_end=timezone.now() + timedelta(days=1))
    assert active_plan_for(user).code == "plus"
    Subscription.objects.update(current_period_end=timezone.now() - timedelta(seconds=1))
    assert active_plan_for(user).code == "free"


def test_no_limit_means_unlimited(seeded, user):
    conv = Conversation.objects.create(user=user, language="en")
    c = _client(user)
    for _ in range(4):
        assert _ask(c, conv).status_code == 201


def test_limit_two_blocks_third_with_localized_402(seeded, user):
    Plan.objects.filter(code="free").update(daily_question_limit=2)
    conv = Conversation.objects.create(user=user, language="en")
    c = _client(user)
    assert _ask(c, conv).status_code == 201
    assert _ask(c, conv).status_code == 201
    before = Message.objects.filter(role="user").count()
    for lang, word in (("en", "limit"), ("ru", "лимит"), ("uz", "limiti")):
        resp = _ask(c, conv, lang=lang)
        assert resp.status_code == 402
        body = resp.json()
        assert body["code"] == "plan_limit" and body["plan"] == "free" and body["limit"] == 2
        assert word in body["detail"]
    assert Message.objects.filter(role="user").count() == before  # nothing stored


def test_stream_endpoint_returns_402_before_streaming(seeded, user):
    Plan.objects.filter(code="free").update(daily_question_limit=1)
    conv = Conversation.objects.create(user=user, language="en")
    c = _client(user)
    assert _ask(c, conv, stream=True).status_code == 200
    resp = _ask(c, conv, stream=True)
    assert resp.status_code == 402
    assert resp.json()["code"] == "plan_limit"


def test_staff_never_limited(seeded):
    staff = User.objects.create_user(email="s@example.com", password="pw-123-strong", is_staff=True)
    Plan.objects.filter(code="free").update(daily_question_limit=1)
    conv = Conversation.objects.create(user=staff, language="en")
    c = _client(staff)
    for _ in range(3):
        assert _ask(c, conv).status_code == 201


def test_yesterdays_messages_do_not_count(seeded, user):
    Plan.objects.filter(code="free").update(daily_question_limit=1)
    conv = Conversation.objects.create(user=user, language="en")
    old = Message.objects.create(conversation=conv, role="user", content="old")
    Message.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=1, hours=1))
    assert _ask(_client(user), conv).status_code == 201


def test_paid_plan_limit_applies_instead_of_free(seeded, user):
    Plan.objects.filter(code="free").update(daily_question_limit=1)
    plus = Plan.objects.get(code="plus")  # unlimited
    Subscription.objects.create(user=user, plan=plus, current_period_end=timezone.now() + timedelta(days=5))
    conv = Conversation.objects.create(user=user, language="en")
    c = _client(user)
    for _ in range(3):
        assert _ask(c, conv).status_code == 201


def test_plans_endpoint_is_public_and_localized(seeded):
    Plan.objects.filter(code="plus").update(price_uzs=49000, daily_question_limit=100)
    Plan.objects.filter(code="business").update(is_active=False)
    resp = APIClient().get(reverse("billing-plans"), {"lang": "ru"})
    assert resp.status_code == 200
    plans = {p["code"]: p for p in resp.json()["plans"]}
    assert set(plans) == {"free", "plus"}
    assert plans["free"]["name"] == "Бесплатный" and plans["free"]["price_uzs"] is None
    assert plans["free"]["for_sale"] is False
    assert plans["plus"]["price_uzs"] == 49000 and plans["plus"]["daily_question_limit"] == 100


def test_me_requires_auth_and_reports_usage(seeded, user):
    assert APIClient().get(reverse("billing-me")).status_code == 401
    Plan.objects.filter(code="free").update(daily_question_limit=5)
    conv = Conversation.objects.create(user=user, language="en")
    Message.objects.create(conversation=conv, role="user", content="q")
    data = _client(user).get(reverse("billing-me")).json()
    assert data["plan"]["code"] == "free" and data["used_today"] == 1
    assert data["limit"] == 5 and data["unlimited"] is False and data["subscription_end"] is None


def test_config_billing_enabled_needs_price_and_provider(seeded, settings):
    url = reverse("public-config")
    assert APIClient().get(url).json()["billing_enabled"] is False
    settings.PAYME_MERCHANT_KEY, settings.PAYME_MERCHANT_ID = "k", "m"
    assert APIClient().get(url).json()["billing_enabled"] is False  # configured but no price
    Plan.objects.filter(code="plus").update(price_uzs=49000)
    assert APIClient().get(url).json()["billing_enabled"] is True
