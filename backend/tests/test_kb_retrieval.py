"""B1 — Knowledge Base chunks merge into RAG retrieval alongside scenarios."""
import pytest

from chat import retrieval
from knowledge.models import KnowledgeChunk, KnowledgeSource
from scenarios.models import Category, Scenario, ScenarioEmbedding

pytestmark = pytest.mark.django_db


@pytest.fixture
def scenario():
    cat = Category.objects.create(
        slug="s", name={"en": "S"}, description={"en": ""}, order=1
    )
    return Scenario.objects.create(
        category=cat,
        slug="passport-renewal",
        title={"en": "Passport renewal"},
        body={"en": "To renew your passport, apply at the migration office."},
        source_url="https://gov.uz/passport",
        is_published=True,
    )


def _kb_source(text, *, title="Tax note", url="https://soliq.uz/x", active=True, embedding=None):
    src = KnowledgeSource.objects.create(
        source_type=KnowledgeSource.PASTE, title=title, url=url, raw_text=text,
        is_active=active, status=KnowledgeSource.STATUS_INDEXED,
    )
    KnowledgeChunk.objects.create(source=src, order=0, text=text, embedding=embedding or [])
    return src


def test_keyword_merges_scenario_and_kb(scenario):
    _kb_source("Passport renewal fee and required documents at the office.")
    results = retrieval.retrieve("passport renewal documents", "en")
    origins = {r["origin"] for r in results}
    assert "scenario" in origins and "kb" in origins
    kb = next(r for r in results if r["origin"] == "kb")
    assert kb["slug"] is None
    assert kb["source_url"] == "https://soliq.uz/x"
    assert kb["title"] == "Tax note"


def test_inactive_kb_excluded(scenario):
    _kb_source("passport passport passport secret", active=False)
    results = retrieval.retrieve("passport", "en")
    assert all(r["origin"] != "kb" for r in results)


def test_vector_merge_respects_min_score(monkeypatch, scenario):
    ScenarioEmbedding.objects.create(scenario=scenario, language="en", vector=[1.0, 0.0])
    _kb_source("close kb doc", embedding=[0.9, 0.1])                       # ~1.0 cosine → in
    _kb_source("far kb doc", url="https://x.uz/2", embedding=[0.0, 1.0])   # 0 cosine → out

    monkeypatch.setattr(retrieval, "embeddings_enabled", lambda: True)
    monkeypatch.setattr(retrieval, "embed_text", lambda text: [1.0, 0.0])

    results = retrieval.retrieve("anything", "en", k=5)
    assert results[0]["mode"] == "vector"
    urls = {r.get("source_url") for r in results}
    assert "https://soliq.uz/x" in urls   # close KB doc kept
    assert "https://x.uz/2" not in urls   # orthogonal KB doc dropped by MIN_SCORE
    assert any(r["origin"] == "scenario" for r in results)
