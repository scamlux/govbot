"""Backfill / refresh embeddings for the whole Scenario Catalog.

Run once after enabling an OpenAI key (or after a bulk import) to populate the vector
store used by chat RAG grounding:

    python manage.py embed_scenarios
"""
from django.core.management.base import BaseCommand

from scenarios.embeddings import embed_scenario
from scenarios.models import Scenario


class Command(BaseCommand):
    help = "Compute and store embeddings for all scenarios (RAG grounding)."

    def handle(self, *args, **options):
        from chat import retrieval

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
