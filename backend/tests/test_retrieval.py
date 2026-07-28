"""Tests for RAG grounding: keyword fallback, vector ranking, and payload injection."""
import pytest
from django.test import override_settings

from chat import retrieval, services
from knowledge.models import KnowledgeChunk, KnowledgeSource
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
    # B1 — mock mode still surfaces grounding sources (keyword-matched on "passport").
    assert any(s["slug"] == "passport-renewal" for s in reply["sources"])


# ---------------------------------------------------------------------------
# B4 — tunable knobs + offline eval harness
# ---------------------------------------------------------------------------
from django.conf import settings as dj_settings  # noqa: E402


def test_retrieval_knobs_read_from_settings():
    assert retrieval.TOP_K == dj_settings.RETRIEVAL_TOP_K
    assert retrieval.MIN_SCORE == pytest.approx(dj_settings.RETRIEVAL_MIN_SCORE)


# A tiny labelled set: query -> the scenario it should ground on.
EVAL_SET = [
    ("How do I renew my passport?", "passport-renewal"),
    ("passport renewal migration office", "passport-renewal"),
    ("How to register a business company?", "business-registration"),
    ("register a company portal", "business-registration"),
]


def _hit_rate(mode_results):
    hits = sum(1 for expected, got in mode_results if got == expected)
    return hits / len(mode_results)


def test_keyword_mode_hit_rate(catalog):
    results = [
        (expected, (retrieval.retrieve(query, "en") or [{}])[0].get("slug"))
        for query, expected in EVAL_SET
    ]
    rate = _hit_rate(results)
    assert rate >= 0.75, f"keyword hit-rate regressed: {rate:.2f}\n{results}"


def test_vector_mode_hit_rate(catalog, monkeypatch):
    # Simulate embeddings: each scenario embeds to a distinct basis vector, and a query
    # embeds to the vector of its expected scenario (a well-behaved embedding model).
    passport = Scenario.objects.get(slug="passport-renewal")
    business = Scenario.objects.get(slug="business-registration")
    ScenarioEmbedding.objects.create(scenario=passport, language="en", vector=[1.0, 0.0])
    ScenarioEmbedding.objects.create(scenario=business, language="en", vector=[0.0, 1.0])
    query_vecs = {
        "passport-renewal": [1.0, 0.0],
        "business-registration": [0.0, 1.0],
    }

    monkeypatch.setattr(retrieval, "embeddings_enabled", lambda: True)

    results = []
    for query, expected in EVAL_SET:
        monkeypatch.setattr(retrieval, "embed_text", lambda text, e=expected: query_vecs[e])
        got = (retrieval.retrieve(query, "en") or [{}])[0].get("slug")
        results.append((expected, got))
    assert _hit_rate(results) == 1.0, results


# ---------------------------------------------------------------------------
# R3 — env/settings overrides actually govern retrieval (read at call time)
# ---------------------------------------------------------------------------
def _two_scenario_vectors(monkeypatch):
    """Passport ⟂-ish Business: cosine([1,0], v) is 1.0 and 0.6, both above the 0.28 floor."""
    passport = Scenario.objects.get(slug="passport-renewal")
    business = Scenario.objects.get(slug="business-registration")
    ScenarioEmbedding.objects.create(scenario=passport, language="en", vector=[1.0, 0.0])
    ScenarioEmbedding.objects.create(scenario=business, language="en", vector=[0.6, 0.8])
    monkeypatch.setattr(retrieval, "embeddings_enabled", lambda: True)
    monkeypatch.setattr(retrieval, "embed_text", lambda text: [1.0, 0.0])


def test_env_override_top_k_limits_results(catalog, monkeypatch):
    _two_scenario_vectors(monkeypatch)
    # Both scenarios clear the default floor, so the default top-k returns both, ranked.
    baseline = retrieval.retrieve("anything", "en")
    assert [r["slug"] for r in baseline] == ["passport-renewal", "business-registration"]

    # override_settings drives settings.RETRIEVAL_TOP_K, which retrieve() reads at call time —
    # the same setting the RETRIEVAL_TOP_K env var feeds. It must now cap the output.
    with override_settings(RETRIEVAL_TOP_K=1):
        limited = retrieval.retrieve("anything", "en")
    assert [r["slug"] for r in limited] == ["passport-renewal"]


def test_env_override_min_score_filters_results(catalog, monkeypatch):
    _two_scenario_vectors(monkeypatch)
    # Raising the cosine floor above 0.6 must drop the weaker (0.6) match at call time.
    with override_settings(RETRIEVAL_MIN_SCORE=0.7):
        filtered = retrieval.retrieve("anything", "en")
    assert [r["slug"] for r in filtered] == ["passport-renewal"]

    # And a floor below both keeps both — proving the knob, not a fixed constant, decides.
    with override_settings(RETRIEVAL_MIN_SCORE=0.5):
        kept = retrieval.retrieve("anything", "en")
    assert [r["slug"] for r in kept] == ["passport-renewal", "business-registration"]


# ---------------------------------------------------------------------------
# R3 — merge deduplication (no duplicate scenario / source url in the top)
# ---------------------------------------------------------------------------
def test_merge_dedupes_same_url_and_keeps_distinct_sources(catalog):
    # A KB source whose url collides with the passport scenario's source_url, plus two chunks:
    # scenario + both chunks all point at gov.uz/passport and must collapse to one snippet.
    dup = KnowledgeSource.objects.create(
        source_type=KnowledgeSource.URL,
        title="KB Passport",
        url="https://gov.uz/passport",
        is_active=True,
    )
    KnowledgeChunk.objects.create(source=dup, order=0, text="passport passport office")
    KnowledgeChunk.objects.create(source=dup, order=1, text="passport renewal office")
    # A distinct KB source (different url) that also matches — must survive alongside.
    other = KnowledgeSource.objects.create(
        source_type=KnowledgeSource.URL,
        title="KB Other",
        url="https://gov.uz/other-office",
        is_active=True,
    )
    KnowledgeChunk.objects.create(source=other, order=0, text="office help desk")

    results = retrieval.retrieve("passport office", "en")
    assert all(r["mode"] == "keyword" for r in results)
    urls = [r["source_url"] for r in results if r["source_url"]]
    assert len(urls) == len(set(urls)), f"duplicate source_url in top: {urls}"
    assert set(urls) == {"https://gov.uz/passport", "https://gov.uz/other-office"}


def test_merge_dedupes_kb_chunks_of_same_source(catalog):
    # Two chunks of one KB source, matched by keyword, must yield a single snippet.
    src = KnowledgeSource.objects.create(
        source_type=KnowledgeSource.URL,
        title="Visa KB",
        url="https://kb.gov.uz/visa",
        is_active=True,
    )
    KnowledgeChunk.objects.create(source=src, order=0, text="visa visa application")
    KnowledgeChunk.objects.create(source=src, order=1, text="visa requirements checklist")

    results = retrieval.retrieve("visa requirements", "en")
    kb = [r for r in results if r["origin"] == "kb"]
    assert len(kb) == 1
    assert kb[0]["source_url"] == "https://kb.gov.uz/visa"


# ---------------------------------------------------------------------------
# R3 — keyless degradation (keyword mode) stays intact
# ---------------------------------------------------------------------------
def test_keyword_degradation_preserved_without_key(catalog):
    # conftest clears OPENAI_API_KEY, so vector mode is impossible and we must fall back.
    assert retrieval.embeddings_enabled() is False
    results = retrieval.retrieve("How do I renew my passport?", "en")
    assert results, "keyword fallback must still ground without an OpenAI key"
    assert results[0]["mode"] == "keyword"
    assert results[0]["slug"] == "passport-renewal"
    # The dedup invariant holds on the keyless path too.
    urls = [r["source_url"] for r in results if r["source_url"]]
    assert len(urls) == len(set(urls))
