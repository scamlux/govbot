"""Tests for RAG grounding: keyword fallback, vector ranking, and payload injection."""
import pytest

from chat import retrieval, services
from scenarios.models import Category, Scenario, ScenarioEmbedding

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog():
    cat = Category.objects.create(
        slug="services",
        name={"uz": "Xizmatlar", "ru": "Услуги", "en": "Services"},
        description={"uz": "", "ru": "", "en": ""},
        order=1,
    )
    passport = Scenario.objects.create(
        category=cat,
        slug="passport-renewal",
        title={"uz": "Pasport", "ru": "Паспорт", "en": "Passport renewal"},
        body={
            "uz": "Pasportni yangilash tartibi.",
            "ru": "Порядок обновления паспорта.",
            "en": "To renew your passport, apply at the migration office.",
        },
        source_url="https://gov.uz/passport",
        tags=["passport"],
        is_published=True,
    )
    Scenario.objects.create(
        category=cat,
        slug="business-registration",
        title={"uz": "Biznes", "ru": "Бизнес", "en": "Business registration"},
        body={
            "uz": "Biznesni ro'yxatdan o'tkazish.",
            "ru": "Регистрация бизнеса.",
            "en": "Register a company through the one-stop portal.",
        },
        is_published=True,
    )
    Scenario.objects.create(
        category=cat,
        slug="draft",
        title={"uz": "x", "ru": "x", "en": "Unpublished passport note"},
        body={"uz": "x", "ru": "x", "en": "passport passport passport draft"},
        is_published=False,
    )
    return passport


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def test_cosine_basic():
    assert retrieval.cosine([1, 0], [1, 0]) == pytest.approx(1.0)
    assert retrieval.cosine([1, 0], [0, 1]) == pytest.approx(0.0)
    assert retrieval.cosine([], [1]) == 0.0  # length mismatch / empty → 0


# ---------------------------------------------------------------------------
# Keyword fallback (mock mode: no OPENAI key)
# ---------------------------------------------------------------------------
def test_keyword_retrieve_finds_relevant_scenario(catalog):
    results = retrieval.retrieve("How do I renew my passport?", "en")
    assert results, "expected at least one grounding snippet"
    assert results[0]["slug"] == "passport-renewal"
    assert results[0]["mode"] == "keyword"
    assert results[0]["source_url"] == "https://gov.uz/passport"


def test_keyword_retrieve_ignores_unpublished(catalog):
    results = retrieval.retrieve("passport", "en")
    slugs = {r["slug"] for r in results}
    assert "draft" not in slugs


def test_keyword_retrieve_no_match_returns_empty(catalog):
    assert retrieval.retrieve("zzzzz nonexistent topic", "en") == []


# ---------------------------------------------------------------------------
# Vector path (simulate an OpenAI key + embeddings)
# ---------------------------------------------------------------------------
def test_vector_retrieve_ranks_by_cosine(catalog, monkeypatch):
    # Give the two published scenarios orthogonal vectors.
    passport = Scenario.objects.get(slug="passport-renewal")
    business = Scenario.objects.get(slug="business-registration")
    ScenarioEmbedding.objects.create(scenario=passport, language="en", vector=[1.0, 0.0])
    ScenarioEmbedding.objects.create(scenario=business, language="en", vector=[0.0, 1.0])

    monkeypatch.setattr(retrieval, "embeddings_enabled", lambda: True)
    monkeypatch.setattr(retrieval, "embed_text", lambda text: [1.0, 0.0])

    results = retrieval.retrieve("anything", "en")
    assert [r["slug"] for r in results] == ["passport-renewal"]  # business scored 0 < floor
    assert results[0]["mode"] == "vector"


# ---------------------------------------------------------------------------
# Payload injection
# ---------------------------------------------------------------------------
def test_build_payload_injects_grounding(catalog):
    messages = [{"role": "user", "content": "How do I renew my passport?"}]
    payload = services.build_payload(messages, "en")
    # system prompt + grounding + the user message
    assert payload[0]["role"] == "system"
    assert payload[1]["role"] == "system"
    assert "reference material" in payload[1]["content"].lower()
    assert "https://gov.uz/passport" in payload[1]["content"]
    assert payload[-1]["content"] == "How do I renew my passport?"


def test_build_payload_without_match_has_no_grounding(catalog):
    messages = [{"role": "user", "content": "zzzzz nonexistent topic"}]
    payload = services.build_payload(messages, "en")
    assert len(payload) == 2  # base system prompt + user message only
    assert payload[0]["role"] == "system"
    assert payload[1]["role"] == "user"


def test_generate_reply_still_mock_without_key(catalog):
    # In mock mode generate_reply returns the canned reply and never calls OpenAI.
    reply = services.generate_reply(
        [{"role": "user", "content": "passport"}], "en"
    )
    assert reply["model"] == "mock"
    assert "Demo mode" in reply["content"]
