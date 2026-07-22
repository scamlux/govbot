"""Backfill / refresh embeddings for the whole Scenario Catalog.

Run once after enabling an OpenAI key (or after a bulk import) to populate the vector
store used by chat RAG grounding:

    python manage.py embed_scenarios

``--sync-only`` skips OpenAI entirely and just mirrors the already-stored JSON vectors
into the optional pgvector column (backfill after applying migration 0003):

    python manage.py embed_scenarios --sync-only
"""
import logging

from django.core.management.base import BaseCommand

from scenarios import vectorstore
from scenarios.embeddings import embed_scenario
from scenarios.models import Scenario, ScenarioEmbedding

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Compute and store embeddings for all scenarios (RAG grounding)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sync-only",
            action="store_true",
            help=(
                "Do not call OpenAI; only mirror existing JSON vectors into the "
                "pgvector column (no-op where pgvector is unavailable)."
            ),
        )

    def handle(self, *args, **options):
        from chat import retrieval

        if options["sync_only"]:
            self._sync_only()
            return

        if not retrieval.embeddings_enabled():
            self.stdout.write(
                "OPENAI_API_KEY is not set — embeddings are disabled. Chat grounding will "
                "use keyword search until a key is configured."
            )
            return

        total = 0
        scenarios = Scenario.objects.all()
        for scenario in scenarios:
            written = embed_scenario(scenario)
            total += written
            self.stdout.write(f"  {scenario.slug}: {written} vector(s)")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {total} vector(s) across {scenarios.count()} scenario(s) "
                f"using model '{retrieval.EMBEDDING_MODEL}'."
            )
        )

    def _sync_only(self):
        """Mirror every stored JSON vector into the pgvector shadow column (keyless)."""
        if not vectorstore.pgvector_available():
            self.stdout.write(
                "pgvector is unavailable on this database — nothing to sync "
                "(retrieval keeps using brute-force cosine over JSON)."
            )
            return

        synced = failed = 0
        for row in ScenarioEmbedding.objects.exclude(vector=[]).iterator():
            try:
                vectorstore.sync_embedding_vector(row)
                synced += 1
            except Exception:  # noqa: BLE001 — one bad row must not abort the backfill
                failed += 1
                logger.exception("pgvector sync failed for ScenarioEmbedding %s", row.pk)

        message = f"Synced {synced} vector(s) into pgvector."
        if failed:
            message += f" {failed} failed (see logs)."
        self.stdout.write(self.style.SUCCESS(message))
