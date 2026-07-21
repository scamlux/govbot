import pytest

from knowledge import indexing
from knowledge.models import KnowledgeSource


class _FakeEmbed:
    """Deterministic embed_texts stand-in that counts how many times it's called."""

    def __init__(self):
        self.calls = 0

    def __call__(self, texts):
        self.calls += 1
        return [[float(len(t) % 7), 0.5, 0.25, 0.125] for t in texts]


@pytest.fixture
def fake_embed(monkeypatch):
    fe = _FakeEmbed()
    monkeypatch.setattr(indexing, "embed_texts", fe)
    return fe


def _paste(text="Passport renewal requires an application and a fee. " * 30):
    return KnowledgeSource.objects.create(source_type=KnowledgeSource.PASTE, raw_text=text)


@pytest.mark.django_db
def test_index_source_success(fake_embed):
    src = _paste()
    n = indexing.index_source(src)
    src.refresh_from_db()
    assert n > 0
    assert src.status == KnowledgeSource.STATUS_INDEXED
    assert src.chunk_count == n
    assert src.checksum != ""
    assert src.last_indexed_at is not None
    chunks = list(src.chunks.all())
    assert chunks and all(len(c.embedding) == 4 for c in chunks)


@pytest.mark.django_db
def test_reindex_unchanged_skips_embedding(fake_embed):
    src = _paste()
    indexing.index_source(src)
    assert fake_embed.calls >= 1
    calls_after_first = fake_embed.calls
    src.refresh_from_db()
    indexing.index_source(src)  # same text
    assert fake_embed.calls == calls_after_first  # no re-embed
    src.refresh_from_db()
    assert src.status == KnowledgeSource.STATUS_INDEXED


@pytest.mark.django_db
def test_index_failure_is_safe(monkeypatch):
    def boom(texts):
        raise RuntimeError("embedding backend down")

    monkeypatch.setattr(indexing, "embed_texts", boom)
    src = _paste()
    n = indexing.index_source(src)  # must not raise
    src.refresh_from_db()
    assert n == 0
    assert src.status == KnowledgeSource.STATUS_FAILED
    assert "embedding backend down" in src.error


@pytest.mark.django_db
def test_run_kb_tick_is_bounded(fake_embed):
    _paste("First source text about visas. " * 20)
    _paste("Second source text about taxes. " * 20)
    result = indexing.run_kb_tick(limit=1)
    assert result == {"processed": 1, "failed": 0}
    indexed = KnowledgeSource.objects.filter(status=KnowledgeSource.STATUS_INDEXED).count()
    pending = KnowledgeSource.objects.filter(status=KnowledgeSource.STATUS_PENDING).count()
    assert indexed == 1 and pending == 1
