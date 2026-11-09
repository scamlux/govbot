from django.core.management.base import BaseCommand

from billing.seed import seed_plans


class Command(BaseCommand):
    help = "Create the free/plus/business plans if missing (not for sale, no limits)."

    def handle(self, *args, **options):
        self.stdout.write(f"Plans created: {seed_plans()}")
