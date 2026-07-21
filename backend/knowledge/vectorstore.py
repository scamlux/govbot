"""Optional pgvector acceleration for KnowledgeChunk retrieval.

The canonical embedding lives in ``KnowledgeChunk.embedding`` (JSON). On PostgreSQL with the
``vector`` extension we mirror it into an ``embedding_vec vector(1536)`` column (added by
migration ``0002``) and query it with an HNSW index. Everywhere else (SQLite, or Postgres
before the pgvector migration) these functions are no-ops and retrieval falls back to
brute-force cosine over the JSON. pgvector is an acceleration, never a hard dependency.
"""
import logging

from django.db import connection

logger = logging.getLogger(__name__)

VECTOR_DIM = 1536


def _table_names():
    from .models import KnowledgeChunk, KnowledgeSource

    return KnowledgeChunk._meta.db_table, KnowledgeSource._meta.db_table


def pgvector_available(conn=None) -> bool:
    """True only on PostgreSQL where the ``vector`` extension and shadow column both exist."""
    conn = conn or connection
    if conn.vendor != "postgresql":
        return False
    chunk_table, _ = _table_names()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            if cur.fetchone() is None:
                return False
            cur.execute(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = 'embedding_vec'",
                [chunk_table],
            )
            return cur.fetchone() is not None
    except Exception:  # noqa: BLE001 — never let a probe break retrieval
        logger.debug("pgvector availability probe failed", exc_info=True)
        return False


def _to_literal(vector) -> str:
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


def _write_vec(chunk_id: int, embedding) -> None:
    if not embedding:
        return
    chunk_table, _ = _table_names()
    with connection.cursor() as cur:
        cur.execute(
            f"UPDATE {chunk_table} SET embedding_vec = %s::vector WHERE id = %s",  # noqa: S608 (table name is a trusted model attr)
            [_to_literal(embedding), chunk_id],
        )


def sync_chunk_vector(chunk) -> None:
    """Mirror one chunk's JSON embedding into the pgvector column (no-op when unavailable)."""
    if not pgvector_available():
        return
    _write_vec(chunk.pk, chunk.embedding)


def sync_source_vectors(source) -> None:
    """Mirror every chunk of ``source`` into the pgvector column (no-op when unavailable)."""
    if not pgvector_available():
        return
    for chunk in source.chunks.all():
        _write_vec(chunk.pk, chunk.embedding)


def ann_search(query_vec, k: int, active_only: bool = True) -> list[tuple[int, float]]:
    """Return ``[(chunk_id, cosine_similarity)]`` for the top-``k`` nearest chunks (pgvector)."""
    if not query_vec or not pgvector_available():
        return []
    chunk_table, source_table = _table_names()
    literal = _to_literal(query_vec)
    active_clause = "AND s.is_active" if active_only else ""
    sql = (  # noqa: S608 — identifiers are trusted model table names, values are parameterized
        f"SELECT c.id, 1 - (c.embedding_vec <=> %s::vector) AS score "
        f"FROM {chunk_table} c JOIN {source_table} s ON s.id = c.source_id "
        f"WHERE c.embedding_vec IS NOT NULL {active_clause} "
        f"ORDER BY c.embedding_vec <=> %s::vector LIMIT %s"
    )
    with connection.cursor() as cur:
        cur.execute(sql, [literal, literal, k])
        return [(row[0], float(row[1])) for row in cur.fetchall()]
