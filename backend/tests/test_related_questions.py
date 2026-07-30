"""R4 — related questions: up to 3 catalog questions related to a message.

Covers the four required properties: at most 3 results, localized to the requested language,
the already-asked question excluded, and keyless (mock-mode) keyword degradation working.
conftest clears ``OPENAI_API_KEY`` so every test here exercises the keyword fallback path.
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat import retrieval
from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog():
    """Four published passport-topic scenarios (share the token 'passport'/'паспорт'),
    one unrelated scenario, and one unpublished passport scenario."""
    cat = Category.objects.create(
        slug="services",
        name={"uz": "Xizmatlar", "ru": "Услуги", "en": "Services"},
        order=1,
    )
    Scenario.objects.create(
        category=cat,
        slug="passport-renewal",
        title={"uz": "Pasportni almashtirish", "ru": "Замена паспорта", "en": "Passport renewal"},
        body={
            "uz": "Pasportni yangilash tartibi.",
            "ru": "Как обновить паспорт в отделении миграции.",
            "en": "How to renew your passport at the migration office.",
        },
        source_url="https://gov.uz/passport",
        is_published=True,
    )
    Scenario.objects.create(
        category=cat,
        slug="passport-lost",
        title={"uz": "Yo'qolgan pasport", "ru": "Утерянный паспорт", "en": "Lost passport replacement"},
        body={
            "uz": "Yo'qolgan pasport haqida.",
            "ru": "Что делать если потерян паспорт.",
            "en": "What to do when your passport is lost.",
        },
        is_published=True,
    )
    Scenario.objects.create(
        category=cat,
        slug="passport-child",
        title={"uz": "Bolalar pasporti", "ru": "Детский паспорт", "en": "Child passport application"},
        body={
            "uz": "Bola uchun pasport.",
            "ru": "Как оформить паспорт для ребёнка.",
            "en": "Apply for a passport for a child.",
        },
        is_published=True,
    )
    Scenario.objects.create(
        category=cat,
        slug="passport-fees",
        title={"uz": "Pasport to'lovi", "ru": "Пошлина за паспорт", "en": "Passport fees"},
        body={
            "uz": "Pasport to'lovlari.",
            "ru": "Государственная пошлина за паспорт.",
            "en": "Passport state fee amounts.",
        },
        is_published=True,
    )
    # Unrelated topic — shares no token with a passport query.
    Scenario.objects.create(
        category=cat,
        slug="business-registration",
        title={"uz": "Biznes", "ru": "Бизнес", "en": "Business registration"},
        body={"uz": "Biznesni ro'yxatdan.", "ru": "Регистрация бизнеса.", "en": "Register a company."},
        is_published=True,
    )
    # Unpublished passport scenario — must never surface.
    Scenario.objects.create(
        category=cat,
        slug="passport-draft",
        title={"uz": "x", "ru": "x", "en": "Draft passport note"},
        body={"uz": "x", "ru": "паспорт черновик", "en": "passport draft note"},
        is_published=False,
    )
    return cat


def test_keyless_mode_is_active():
    # Sanity: the whole suite here proves the keyless (no OpenAI key) degradation path.
    assert retrieval.embeddings_enabled() is False


def test_returns_at_most_three(catalog):
    # Four published scenarios match "passport"; the feature must cap the output at 3.
    results = retrieval.related_questions("renew passport", "en")
    assert 0 < len(results) <= 3
    assert len(results) == 3  # four candidates available, exactly three returned


def test_excludes_the_asked_question(catalog):
    # Ask with a scenario's exact title: it must be dropped, and other related ones kept.
    results = retrieval.related_questions("Passport renewal", "en")
    slugs = [r["slug"] for r in results]
    assert "passport-renewal" not in slugs  # the asked question is excluded
    assert len(slugs) >= 1  # …and it did not empty the list (non-vacuous)
    assert any(s.startswith("passport-") for s in slugs)


def test_ignores_unpublished_scenarios(catalog):
    results = retrieval.related_questions("passport", "en")
    assert "passport-draft" not in {r["slug"] for r in results}


def test_titles_are_localized_to_requested_language(catalog):
    results = retrieval.related_questions("обновить паспорт", "ru")
    assert results
    titles = {r["title"] for r in results}
    ru_titles = {"Замена паспорта", "Утерянный паспорт", "Детский паспорт", "Пошлина за паспорт"}
    en_titles = {"Passport renewal", "Lost passport replacement", "Child passport application", "Passport fees"}
    assert titles <= ru_titles  # every returned title is the Russian localization
    assert not (titles & en_titles)  # and never the English one


def test_exclude_slug_drops_source_scenario(catalog):
    results = retrieval.related_questions("passport", "en", exclude_slug="passport-fees")
    assert "passport-fees" not in {r["slug"] for r in results}
    assert results  # other passport scenarios still returned


def test_blank_message_returns_empty(catalog):
    assert retrieval.related_questions("   ", "en") == []


def test_no_match_returns_empty(catalog):
    assert retrieval.related_questions("zzzzz nonexistent topic", "en") == []


# ---------------------------------------------------------------------------
# Endpoint: GET /api/chat/related/
# ---------------------------------------------------------------------------
@pytest.fixture
def auth_client():
    user = User.objects.create_user(
        email="r4@example.com", full_name="R4", password="pw-123-strong"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_endpoint_returns_related_questions(catalog, auth_client):
    resp = auth_client.get(
        reverse("chat-related"), {"message": "renew passport", "lang": "en"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "related_questions" in data
    questions = data["related_questions"]
    assert 0 < len(questions) <= 3
    assert all({"slug", "title"} <= set(q) for q in questions)


def test_endpoint_excludes_asked_and_honours_exclude_param(catalog, auth_client):
    resp = auth_client.get(
        reverse("chat-related"),
        {"message": "Passport renewal", "lang": "en", "exclude": "passport-fees"},
    )
    assert resp.status_code == 200
    slugs = {q["slug"] for q in resp.json()["related_questions"]}
    assert "passport-renewal" not in slugs  # asked question (exact title match)
    assert "passport-fees" not in slugs  # explicit exclude param


def test_endpoint_requires_authentication(catalog):
    resp = APIClient().get(
        reverse("chat-related"), {"message": "passport", "lang": "en"}
    )
    assert resp.status_code in (401, 403)
