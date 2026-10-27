"""F4 — retention: delete conversations untouched for longer than the retention window.

    python manage.py purge_conversations            # uses CONVERSATION_RETENTION_DAYS
    python manage.py purge_conversations --days 180 # explicit window
    python manage.py purge_conversations --dry-run  # report only

``CONVERSATION_RETENTION_DAYS=0`` (the default) means "keep forever": the command then
does nothing unless ``--days`` is passed. Schedule it daily (cron / Render cron job).
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from chat.models import Conversation


class Command(BaseCommand):
    help = "Delete conversations not updated within the retention window (F4)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=None)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        days = opts["days"] if opts["days"] is not None else settings.CONVERSATION_RETENTION_DAYS
        if not days or days <= 0:
            self.stdout.write("Retention disabled (CONVERSATION_RETENTION_DAYS=0); nothing purged.")
            return
        cutoff = timezone.now() - timedelta(days=days)
        qs = Conversation.objects.filter(updated_at__lt=cutoff)
        count = qs.count()
        if opts["dry_run"]:
            self.stdout.write(f"Would delete {count} conversation(s) older than {days} days.")
            return
        qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {count} conversation(s) older than {days} days."))
