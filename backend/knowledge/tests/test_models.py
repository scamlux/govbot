import pytest

from knowledge.models import KnowledgeChunk, KnowledgeSource


@pytest.mark.django_db
def test_source_defaults():
    src = KnowledgeSource.objects.create(source_type=KnowledgeSource.PASTE, raw_text="hello")
    assert src.status == KnowledgeSource.STATUS_PENDING
    assert src.is_active is True
    assert src.chunk_count == 0
    assert src.checksum == ""
    assert src.last_indexed_at is None


def test_checksum_stable_and_distinct():
    assert KnowledgeSource.compute_checksum("a") == KnowledgeSource.compute_checksum("a")
    assert KnowledgeSource.compute_checksum("a") != KnowledgeSource.compute_checksum("b")
    assert len(KnowledgeSource.compute_checksum("a")) == 64


@pytest.mark.django_db
def test_chunk_relation_and_ordering():
    src = KnowledgeSource.objects.create(source_type=KnowledgeSource.PASTE, raw_text="x")
    KnowledgeChunk.objects.create(source=src, order=1, text="second", embedding=[0.1, 0.2])
    KnowledgeChunk.objects.create(source=src, order=0, text="first", embedding=[0.3])
    ordered = list(src.chunks.values_list("order", flat=True))
    assert ordered == [0, 1]
