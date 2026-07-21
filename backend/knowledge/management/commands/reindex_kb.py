"""Index Knowledge Base sources from the CLI (Render Shell / local dev).

Usage:
  python manage.py reindex_kb            # drain all pending sources
  python manage.py reindex_kb --all      # reindex every active source
  python manage.py reindex_kb --source 5 # reindex one source by id
"""
from django.core.management.base import BaseCommand, CommandError

from knowledge.indexing import index_source, run_kb_tick
from knowledge.models import KnowledgeSource


class Command(BaseCommand):
    help = "Index Knowledge Base sources (pending by default, or --all / --source ID)."

    def add_arguments(self, parser):
        parser.add_argument("--source", type=int, default=None, help="Index a single source by id.")
        parser.add_argument("--all", action="store_true", help="Reindex every active source.")

    def handle(self, *args, **opts):
        if opts["source"]:
            try:
                src = KnowledgeSource.objects.get(pk=opts["source"])
            except KnowledgeSource.DoesNotExist as exc:
                raise CommandError(f"source {opts['source']} not found") from exc
            n = index_source(src)
            self.stdout.write(f"source {src.pk}: {src.status} ({n} chunks)")
            return

        if opts["all"]:
            for src in KnowledgeSource.objects.filter(is_active=True):
                index_source(src)
                self.stdout.write(f"source {src.pk}: {src.status} ({src.chunk_count} chunks)")
            return

        total = {"processed": 0, "failed": 0}
        while True:
            result = run_kb_tick(limit=50)
            total["processed"] += result["processed"]
            total["failed"] += result["failed"]
            if result["processed"] == 0 and result["failed"] == 0:
                break
        self.stdout.write(f"done: {total}")
