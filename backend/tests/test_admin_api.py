import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message, MessageFeedback
from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client():
    admin = User.objects.create_superuser(email="admin@example.com", password="Adm!n12345")
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def user_client():
    user = User.objects.create_user(email="plain@example.com", password="Us3r!12345")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_admin_users_list_requires_staff(user_client):
    assert user_client.get("/api/admin/users/").status_code == 403


def test_admin_users_list_for_staff(admin_client):
    resp = admin_client.get("/api/admin/users/")
    assert resp.status_code == 200
    assert any(u["email"] == "admin@example.com" for u in resp.json())


def test_admin_create_category_with_translations(admin_client):
    payload = {
        "slug": "new-cat",
        "icon": "📦",
        "name": {"uz": "Yangi", "ru": "Новый", "en": "New"},
        "description": {"en": "desc"},
        "order": 5,
    }
    resp = admin_client.post("/api/admin/categories/", payload, format="json")
    assert resp.status_code == 201
    cat = Category.objects.get(slug="new-cat")
    assert cat.name["ru"] == "Новый"
    # Missing languages are coerced to empty strings, never KeyError.
    assert cat.description["uz"] == ""


def test_admin_scenario_crud(admin_client):
    cat = Category.objects.create(
        slug="c", name={"uz": "", "ru": "", "en": "C"}, order=1
    )
    create = admin_client.post(
        "/api/admin/scenarios/",
        {
            "category": cat.id,
            "slug": "s1",
            "title": {"uz": "", "ru": "", "en": "Title"},
            "body": {"uz": "", "ru": "", "en": "Body"},
            "tags": ["a", "b"],
            "order": 1,
            "is_published": True,
        },
        format="json",
    )
    assert create.status_code == 201
    sid = create.json()["id"]

    patch = admin_client.patch(
        f"/api/admin/scenarios/{sid}/", {"is_published": False}, format="json"
    )
    assert patch.status_code == 200
    assert Scenario.objects.get(id=sid).is_published is False

    delete = admin_client.delete(f"/api/admin/scenarios/{sid}/")
    assert delete.status_code == 204
    assert not Scenario.objects.filter(id=sid).exists()


def test_admin_category_write_blocked_for_non_staff(user_client):
    resp = user_client.post("/api/admin/categories/", {"slug": "x"}, format="json")
    assert resp.status_code == 403


def test_category_order_auto_increments_when_omitted(admin_client):
    Category.objects.create(slug="a", name={"uz": "", "ru": "", "en": "A"}, order=3)
    resp = admin_client.post(
        "/api/admin/categories/",
        {"slug": "b", "name": {"uz": "", "ru": "", "en": "B"}},  # no order
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["order"] == 4  # max(3) + 1


def test_scenario_order_auto_increments_within_category(admin_client):
    cat = Category.objects.create(slug="c", name={"uz": "", "ru": "", "en": "C"}, order=1)
    Scenario.objects.create(
        category=cat, slug="s0", title={"en": "x"}, body={"en": "x"}, order=7
    )
    resp = admin_client.post(
        "/api/admin/scenarios/",
        {
            "category": cat.id,
            "slug": "s1",
            "title": {"uz": "", "ru": "", "en": "T"},
            "body": {"uz": "", "ru": "", "en": "B"},
        },  # no order
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["order"] == 8  # max(7) + 1 within the category


# --------------------------------------------------------------------------- #
# Helpers for chat-oversight admin API (A3, C1, C2)
# --------------------------------------------------------------------------- #
def _conversation_with_messages(email, language, pairs):
    """Create a conversation with (user_text, assistant_text, sources) rows."""
    user = User.objects.create_user(email=email, password="Pw!12345678")
    conv = Conversation.objects.create(user=user, language=language)
    msgs = []
    for user_text, assistant_text, sources in pairs:
        msgs.append(Message.objects.create(conversation=conv, role=Message.USER, content=user_text))
        msgs.append(
            Message.objects.create(
                conversation=conv, role=Message.ASSISTANT, content=assistant_text, sources=sources
            )
        )
    return conv, msgs


# --------------------------------------------------------------------------- #
# A3 — feedback list
# --------------------------------------------------------------------------- #
def test_admin_feedback_list_filters_and_paginates(admin_client):
    _, msgs = _conversation_with_messages(
        "a@ex.com", "en", [("q1", "a1", None), ("q2", "a2", None)]
    )
    MessageFeedback.objects.create(message=msgs[1], rating="down", reason="wrong")
    MessageFeedback.objects.create(message=msgs[3], rating="up")

    resp = admin_client.get("/api/admin/feedback/?rating=down")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    row = body["results"][0]
    assert row["rating"] == "down"
    assert row["message_content"] == "a1"
    assert row["conversation_language"] == "en"


def test_admin_feedback_list_requires_staff(user_client):
    assert user_client.get("/api/admin/feedback/").status_code == 403


# --------------------------------------------------------------------------- #
# C1 — question analytics
# --------------------------------------------------------------------------- #
def test_admin_question_analytics(admin_client):
    _conversation_with_messages(
        "en@ex.com", "en", [("How to renew passport passport", "ok", None)]
    )
    _conversation_with_messages("ru@ex.com", "ru", [("Как получить визу виза", "ok", None)])

    resp = admin_client.get("/api/admin/analytics/questions/?days=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data["message_count"] == 2
    assert data["conversation_count"] == 2
    langs = {row["language"]: row["count"] for row in data["language_split"]}
    assert langs == {"en": 1, "ru": 1}
    terms = {t["term"] for t in data["top_terms"]}
    assert "passport" in terms and "виза" in terms


def test_admin_analytics_requires_staff(user_client):
    assert user_client.get("/api/admin/analytics/questions/").status_code == 403


# --------------------------------------------------------------------------- #
# C2 — catalog gaps
# --------------------------------------------------------------------------- #
def test_admin_catalog_gaps_ranks_ungrounded_questions(admin_client):
    # Two ungrounded asks of the same question, one grounded ask of another.
    _conversation_with_messages("g1@ex.com", "en", [("driver license rules", "ok", None)])
    _conversation_with_messages("g2@ex.com", "en", [("driver license rules", "ok", None)])
    _conversation_with_messages(
        "g3@ex.com", "en", [("passport renewal", "ok", [{"slug": "p", "title": "P", "source_url": ""}])]
    )

    resp = admin_client.get("/api/admin/analytics/gaps/")
    assert resp.status_code == 200
    gaps = resp.json()["gaps"]
    assert gaps[0]["question"] == "driver license rules"
    assert gaps[0]["count"] == 2
    # The grounded question is not a gap.
    assert all("passport" not in g["question"] for g in gaps)


def test_catalog_gaps_excludes_error_and_demo_replies(admin_client):
    # An OpenAI-error reply (canned text, sources=None) must NOT count as a catalog gap.
    from chat.services import FRIENDLY_ERROR

    _conversation_with_messages(
        "err@ex.com", "en", [("some outage question", FRIENDLY_ERROR["en"], None)]
    )
    resp = admin_client.get("/api/admin/analytics/gaps/")
    assert resp.status_code == 200
    assert resp.json()["gaps"] == []


# ---- C3 monitoring: conversations viewer, usage, health ----
def _seed_conversation():
    owner = User.objects.create_user(email="owner@example.com", password="Own3r!12345")
    conv = Conversation.objects.create(user=owner, title="Passport", language="ru")
    Message.objects.create(conversation=conv, role="user", content="Как получить паспорт?")
    a = Message.objects.create(conversation=conv, role="assistant", content="Вот шаги…", sources=[])
    MessageFeedback.objects.create(message=a, rating="up")
    return conv


def test_admin_conversations_requires_staff(user_client):
    assert user_client.get("/api/admin/conversations/").status_code == 403


def test_admin_conversations_list_for_staff(admin_client):
    _seed_conversation()
    resp = admin_client.get("/api/admin/conversations/")
    assert resp.status_code == 200
    rows = resp.json()["results"]
    row = next(r for r in rows if r["title"] == "Passport")
    assert row["user_email"] == "owner@example.com"
    assert row["message_count"] == 2
    assert "messages" not in row  # list stays lightweight


def test_admin_conversation_detail_for_staff(admin_client):
    conv = _seed_conversation()
    resp = admin_client.get(f"/api/admin/conversations/{conv.id}/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["messages"]) == 2
    assistant = next(m for m in data["messages"] if m["role"] == "assistant")
    assert assistant["feedback"] == {"rating": "up", "reason": ""}


def test_admin_usage_analytics(admin_client, user_client):
    _seed_conversation()
    assert user_client.get("/api/admin/analytics/usage/").status_code == 403
    resp = admin_client.get("/api/admin/analytics/usage/?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["totals"]["messages"] == 2
    assert data["totals"]["conversations"] == 1
    assert isinstance(data["series"], list) and data["series"]
    assert any(l["language"] == "ru" for l in data["by_language"])


def test_admin_health(admin_client, user_client):
    assert user_client.get("/api/admin/health/").status_code == 403
    resp = admin_client.get("/api/admin/health/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["database"]["ok"] is True
    assert data["openai"]["mode"] in ("live", "mock")
    assert "counts" in data and "users" in data["counts"]
