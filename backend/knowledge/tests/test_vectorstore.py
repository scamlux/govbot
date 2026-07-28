from types import SimpleNamespace

import pytest
from django.db import connection

from knowledge import vectorstore
from knowledge.models import KnowledgeChunk, KnowledgeSource


def test_non_postgres_reports_unavailable():
    assert vectorstore.pgvector_available(SimpleNamespace(vendor="sqlite")) is False


@pytest.mark.django_db
def test_pgvector_unavailable_on_test_db():
    # The test DB is SQLite (conftest) — migration 0002 no-ops, so pgvector is unavailable.
    assert vectorstore.pgvector_available(connection) is False


@pytest.mark.django_db
def test_sync_and_search_are_noops_without_pgvector():
    src = KnowledgeSource.objects.create(source_type=KnowledgeSource.PASTE, raw_text="x")
    chunk = KnowledgeChunk.objects.create(source=src, order=0, text="t", embedding=[0.1, 0.2])
    # None of these should raise or write anything on SQLite.
    vectorstore.sync_chunk_vector(chunk)
    vectorstore.sync_source_vectors(src)
    assert vectorstore.ann_search([0.1, 0.2], 3) == []
    assert vectorstore.ann_search([], 3) == []


def test_vector_literal_format():
    assert vectorstore._to_literal([1, 2.5, 3]) == "[1.0,2.5,3.0]"


@pytest.mark.django_db
def test_write_vec_skips_wrong_dimensionality(caplog):
    # vector(1536) column can't hold a 3-d vector — _write_vec must skip, not raise.
    with caplog.at_level("WARNING", logger="knowledge.vectorstore"):
        vectorstore._write_vec(1, [0.1, 0.2, 0.3])
    assert "Skipping pgvector mirror" in caplog.text
