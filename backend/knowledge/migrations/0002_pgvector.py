"""Optional pgvector acceleration for KnowledgeChunk.

Adds a ``embedding_vec vector(1536)`` shadow column + HNSW cosine index — but ONLY on
PostgreSQL where the ``vector`` extension can be created. On SQLite, or on a Postgres where
the extension is unavailable / not permitted, this migration is a clean no-op and retrieval
falls back to brute-force cosine over the JSON ``embedding``. pgvector is never a hard
dependency.
"""
from django.db import migrations, transaction

FORWARD_SQL = [
    "CREATE EXTENSION IF NOT EXISTS vector",
    "ALTER TABLE knowledge_knowledgechunk ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)",
    "CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_vec_hnsw "
    "ON knowledge_knowledgechunk USING hnsw (embedding_vec vector_cosine_ops)",
]


def enable_pgvector(apps, schema_editor):
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    for stmt in FORWARD_SQL:
        try:
            with transaction.atomic():
                with conn.cursor() as cur:
                    cur.execute(stmt)
        except Exception:  # noqa: BLE001 — pgvector missing/unprivileged ⇒ keep brute-force
            return


def drop_pgvector(apps, schema_editor):
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    with conn.cursor() as cur:
        cur.execute("DROP INDEX IF EXISTS knowledge_chunk_embedding_vec_hnsw")
        cur.execute("ALTER TABLE knowledge_knowledgechunk DROP COLUMN IF EXISTS embedding_vec")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [("knowledge", "0001_initial")]

    operations = [migrations.RunPython(enable_pgvector, drop_pgvector)]
