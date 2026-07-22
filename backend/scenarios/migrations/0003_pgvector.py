"""Optional pgvector acceleration for ScenarioEmbedding.

Adds a ``vector_vec vector(1536)`` shadow column + HNSW cosine index — but ONLY on
PostgreSQL where the ``vector`` extension can be created. On SQLite, or on a Postgres where
the extension is unavailable / not permitted, this migration is a clean no-op and retrieval
falls back to brute-force cosine over the JSON ``vector``. pgvector is never a hard
dependency.
"""
from django.db import migrations, transaction

FORWARD_SQL = [
    "CREATE EXTENSION IF NOT EXISTS vector",
    "ALTER TABLE scenarios_scenarioembedding ADD COLUMN IF NOT EXISTS vector_vec vector(1536)",
    "CREATE INDEX IF NOT EXISTS scenarios_embedding_vector_vec_hnsw "
    "ON scenarios_scenarioembedding USING hnsw (vector_vec vector_cosine_ops)",
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
        cur.execute("DROP INDEX IF EXISTS scenarios_embedding_vector_vec_hnsw")
        cur.execute("ALTER TABLE scenarios_scenarioembedding DROP COLUMN IF EXISTS vector_vec")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [("scenarios", "0002_scenario_source_url_scenarioembedding")]

    operations = [migrations.RunPython(enable_pgvector, drop_pgvector)]
