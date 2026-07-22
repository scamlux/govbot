"""Scenario-catalog pgvector path: graceful fallback plus the ANN branch (monkeypatched).

The test DB is SQLite (conftest), so pgvector is genuinely unavailable — the real ANN SQL
is exercised only on Postgres. Here we verify (a) every vectorstore entry point degrades
to a clean no-op without pgvector, and (b) the retrieval branch wired to ann_search maps
ids back to scenarios, honours MIN_SCORE, and passes the language through.
"""
from types import SimpleNamespace

import pytest
from django.core.management import call_command
from django.db import connection

from chat import retrieval
from scenarios import vectorstore
from scenarios.models import Category, Scenario, ScenarioEmbedding


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


def test_non_postgres_reports_unavailable():
    assert vectorstore.pgvector_available(SimpleNamespace(vendor="sqlite")) is False


@pytest.mark.django_db
def test_pgvector_unavailable_on_test_db():
    # The test DB is SQLite (conftest) — migration 0003 no-ops, so pgvector is unavailable.
    assert vectorstore.pgvector_available(connection) is False


@pytest.mark.django_db
def test_sync_and_search_are_noops_without_pgvector(scenario):
    row = ScenarioEmbedding.objects.create(
        scenario=scenario, language="en", vector=[0.1, 0.2]
    )
    # None of these should raise or write anything on SQLite.
    vectorstore.sync_embedding_vector(row)
    vectorstore.sync_scenario_vectors(scenario)
    assert vectorstore.ann_search([0.1, 0.2], "en", 3) == []
    assert vectorstore.ann_search([], "en", 3) == []


def test_vector_literal_format():
    assert vectorstore._to_literal([1, 2.5, 3]) == "[1.0,2.5,3.0]"


@pytest.mark.django_db
def test_write_vec_skips_wrong_dimensionality():
    # vector(1536) column can't hold a 3-d vector — _write_vec must skip, not raise.
    vectorstore._write_vec(1, [0.1, 0.2, 0.3])


@pytest.mark.django_db
def test_vector_retrieve_uses_ann_when_available(monkeypatch, scenario):
    close = ScenarioEmbedding.objects.create(
        scenario=scenario, language="en", vector=[1.0, 0.0]
    )
    seen = {}

    def fake_ann(query_vec, language, k):
        seen["language"] = language
        # One hit above MIN_SCORE, one below, one for a row that no longer exists.
        return [(close.pk, 0.9), (close.pk + 1000, 0.95), (close.pk, 0.01)]

    monkeypatch.setattr(vectorstore, "pgvector_available", lambda conn=None: True)
    monkeypatch.setattr(vectorstore, "ann_search", fake_ann)

    pairs = retrieval._vector_retrieve([1.0, 0.0], "en", 5)
    assert seen["language"] == "en"  # ann_search filters language in SQL
    assert pairs == [(scenario, 0.9)]  # low score cut by MIN_SCORE, dangling id dropped


@pytest.mark.django_db
def test_sync_only_command_is_keyless_and_safe(monkeypatch, scenario):
    ScenarioEmbedding.objects.create(scenario=scenario, language="en", vector=[0.1, 0.2])
    synced = []

    # Without pgvector the command reports and exits cleanly (no key, no network).
    call_command("embed_scenarios", "--sync-only")

    # With pgvector "available", every stored JSON vector is mirrored.
    from scenarios.management.commands import embed_scenarios as cmd_module

    monkeypatch.setattr(
        cmd_module.vectorstore, "pgvector_available", lambda conn=None: True
    )
    monkeypatch.setattr(
        cmd_module.vectorstore, "sync_embedding_vector", lambda row: synced.append(row.pk)
    )
    call_command("embed_scenarios", "--sync-only")
    assert synced == [ScenarioEmbedding.objects.get().pk]


@pytest.mark.django_db
def test_vector_merge_respects_min_score_via_ann(monkeypatch, scenario):
    """End-to-end retrieve() over the ANN branch, mirroring the KB merge test."""
    close = ScenarioEmbedding.objects.create(
        scenario=scenario, language="en", vector=[1.0, 0.0]
    )

    monkeypatch.setattr(retrieval, "embeddings_enabled", lambda: True)
    monkeypatch.setattr(retrieval, "embed_text", lambda text: [1.0, 0.0])
    from scenarios import vectorstore as scen_vs

    monkeypatch.setattr(scen_vs, "pgvector_available", lambda conn=None: True)
    monkeypatch.setattr(
        scen_vs, "ann_search", lambda vec, language, k: [(close.pk, 0.93)]
    )

    results = retrieval.retrieve("anything", "en", k=5)
    assert results, "ANN hit above MIN_SCORE must surface as a snippet"
    assert results[0]["mode"] == "vector"
    assert results[0]["origin"] == "scenario"
    assert results[0]["slug"] == "passport-renewal"
    assert results[0]["score"] == 0.93
