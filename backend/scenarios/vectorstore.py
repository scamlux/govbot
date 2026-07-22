"""Optional pgvector acceleration for ScenarioEmbedding retrieval.

The canonical embedding lives in ``ScenarioEmbedding.vector`` (JSON). On PostgreSQL with
the ``vector`` extension we mirror it into a ``vector_vec vector(1536)`` column (added by
migration ``0003``) and query it with an HNSW index. Everywhere else (SQLite, or Postgres
before the pgvector migration) these functions are no-ops and retrieval falls back to
brute-force cosine over the JSON. pgvector is an acceleration, never a hard dependency.

Deliberately self-contained (mirrors ``knowledge.vectorstore``) instead of importing it:
``scenarios`` is a base app and must not grow a dependency on ``knowledge``.
"""
import logging

from django.db import connection

logger = logging.getLogger(__name__)

VECTOR_DIM = 1536


def _table_names():
    from .models import Scenario, ScenarioEmbedding

    return ScenarioEmbedding._meta.db_table, Scenario._meta.db_table


def pgvector_available(conn=None) -> bool:
    """True only on PostgreSQL where the ``vector`` extension and shadow column both exist."""
    conn = conn or connection
    if conn.vendor != "postgresql":
        return False
    embedding_table, _ = _table_names()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            if cur.fetchone() is None:
                return False
            cur.execute(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = 'vector_vec'",
                [embedding_table],
            )
            return cur.fetchone() is not None
    except Exception:  # noqa: BLE001 — never let a probe break retrieval
        logger.debug("pgvector availability probe failed", exc_info=True)
        return False


def _to_literal(vector) -> str:
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


def _write_vec(embedding_id: int, vector) -> None:
    if not vector:
        return
    if len(vector) != VECTOR_DIM:
        # The shadow column is fixed at vector(1536); mirroring a different dimensionality
        # would raise on Postgres. The JSON stays canonical, so skipping is safe.
        logger.warning(
            "Skipping pgvector mirror for ScenarioEmbedding %s: %sd vector != %sd column",
            embedding_id,
            len(vector),
            VECTOR_DIM,
        )
        return
    embedding_table, _ = _table_names()
    with connection.cursor() as cur:
        cur.execute(
            f"UPDATE {embedding_table} SET vector_vec = %s::vector WHERE id = %s",  # noqa: S608 (table name is a trusted model attr)
            [_to_literal(vector), embedding_id],
        )


def sync_embedding_vector(row) -> None:
    """Mirror one embedding's JSON vector into the pgvector column (no-op when unavailable)."""
    if not pgvector_available():
        return
    _write_vec(row.pk, row.vector)


def sync_scenario_vectors(scenario) -> None:
    """Mirror every stored embedding of ``scenario`` into the pgvector column (no-op when unavailable)."""
    if not pgvector_available():
        return
    for row in scenario.embeddings.all():
        _write_vec(row.pk, row.vector)


def ann_search(query_vec, language: str, k: int) -> list[tuple[int, float]]:
    """Return ``[(embedding_id, cosine_similarity)]`` for the top-``k`` nearest embeddings.

    Filters in SQL: requested ``language`` only, published scenarios only, mirrored
    vectors only — so uz/ru/en vectors of one scenario never compete with each other.
    """
    if not query_vec or not pgvector_available():
        return []
    embedding_table, scenario_table = _table_names()
    literal = _to_literal(query_vec)
    sql = (  # noqa: S608 — identifiers are trusted model table names, values are parameterized
        f"SELECT e.id, 1 - (e.vector_vec <=> %s::vector) AS score "
        f"FROM {embedding_table} e JOIN {scenario_table} s ON s.id = e.scenario_id "
        f"WHERE e.vector_vec IS NOT NULL AND e.language = %s AND s.is_published "
        f"ORDER BY e.vector_vec <=> %s::vector LIMIT %s"
    )
    with connection.cursor() as cur:
        cur.execute(sql, [literal, language, literal, k])
        return [(row[0], float(row[1])) for row in cur.fetchall()]
