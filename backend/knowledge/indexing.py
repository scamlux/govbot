"""Index Knowledge Base sources: (fetch → parse) → chunk → embed → store chunks.

``index_source`` (re)builds one source's chunks; it is safe (never raises — failures land in
``status='failed'`` + ``error``) and idempotent (unchanged text, detected by checksum, skips
re-embedding). ``run_kb_tick`` drains a bounded number of pending sources — the unit both the
management command and the pg_cron-triggered endpoint call.
"""
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from chat.retrieval import EMBEDDING_MODEL, embed_texts

from . import chunking, parsers, vectorstore
from .fetch import fetch_url
from .models import KnowledgeChunk, KnowledgeSource

logger = logging.getLogger(__name__)


def _tunable(name: str, default):
    return getattr(settings, name, default)


def _ensure_raw_text(source: KnowledgeSource) -> str:
    """Return the source's text, fetching + parsing a URL source on first index."""
    if source.raw_text and source.raw_text.strip():
        return source.raw_text
    if source.source_type == KnowledgeSource.URL:
        if not source.url:
            raise ValueError("URL source has no url")
        ctype, body = fetch_url(source.url)
        if ctype == "application/pdf":
            text = parsers.parse_pdf(body)
        elif ctype == "text/html":
            text = parsers.extract_html(body.decode("utf-8", errors="replace"))
        else:
            text = parsers.parse_text(body)
        source.raw_text = text
        return text
    return source.raw_text or ""


def _embed_pieces(pieces: list[str]):
    """Embed chunks in batches; ``None`` in mock mode / on failure (⇒ store without vectors)."""
    if not pieces:
        return None
    batch = _tunable("KB_EMBED_BATCH", 64)
    out: list[list[float]] = []
    for i in range(0, len(pieces), batch):
        vectors = embed_texts(pieces[i : i + batch])
        if vectors is None:
            return None
        out.extend(vectors)
    return out


def index_source(source: KnowledgeSource) -> int:
    """(Re)build chunks for one source. Returns the chunk count (0 on failure)."""
    source.status = KnowledgeSource.STATUS_INDEXING
    source.error = ""
    source.save(update_fields=["status", "error", "updated_at"])
    try:
        text = (_ensure_raw_text(source) or "").strip()
        if not text:
            raise ValueError("no text to index")

        checksum = KnowledgeSource.compute_checksum(text)
        if checksum == source.checksum and source.chunks.exists():
            source.status = KnowledgeSource.STATUS_INDEXED
            source.last_indexed_at = timezone.now()
            source.save(
                update_fields=["status", "last_indexed_at", "raw_text", "updated_at"]
            )
            return source.chunk_count

        pieces = chunking.chunk_text(
            text, _tunable("KB_CHUNK_TOKENS", 800), _tunable("KB_CHUNK_OVERLAP", 100)
        )
        vectors = _embed_pieces(pieces)

        with transaction.atomic():
            source.chunks.all().delete()
            objs = [
                KnowledgeChunk(
                    source=source,
                    order=i,
                    text=piece,
                    token_count=len(piece.split()),
                    embedding=vectors[i] if vectors else [],
                    model=EMBEDDING_MODEL if vectors else "",
                )
                for i, piece in enumerate(pieces)
            ]
            KnowledgeChunk.objects.bulk_create(objs)
            source.chunk_count = len(objs)
            source.checksum = checksum
            source.status = KnowledgeSource.STATUS_INDEXED
            source.error = ""
            source.last_indexed_at = timezone.now()
            source.save(
                update_fields=[
                    "chunk_count", "checksum", "status", "error",
                    "last_indexed_at", "raw_text", "updated_at",
                ]
            )
        vectorstore.sync_source_vectors(source)
        return len(objs)
    except Exception as exc:  # noqa: BLE001 — indexing must never crash the tick/command
        logger.exception("Indexing source %s failed", source.pk)
        source.status = KnowledgeSource.STATUS_FAILED
        source.error = str(exc)[:2000]
        source.save(update_fields=["status", "error", "updated_at"])
        return 0


def run_kb_tick(limit: int | None = None) -> dict:
    """Index up to ``limit`` pending active sources. Returns ``{processed, failed}``."""
    if limit is None:
        limit = _tunable("KB_TICK_BATCH", 1)
    sources = list(
        KnowledgeSource.objects.filter(
            is_active=True, status=KnowledgeSource.STATUS_PENDING
        ).order_by("updated_at")[:limit]
    )
    processed = failed = 0
    for source in sources:
        index_source(source)
        if source.status == KnowledgeSource.STATUS_FAILED:
            failed += 1
        else:
            processed += 1
    return {"processed": processed, "failed": failed}
