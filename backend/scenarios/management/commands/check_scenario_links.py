"""E4 — verify that every published scenario's ``source_url`` still answers.

    python manage.py check_scenario_links

Prints one line per broken/unreachable link and exits non-zero when any are found, so it
can run as a scheduled job and alert. Stale verification dates are reported too.
"""
import httpx
from django.core.management.base import BaseCommand, CommandError

from scenarios.models import Scenario
from scenarios.serializers import is_stale

TIMEOUT = 10


def check_url(url: str) -> tuple[bool, str]:
    """``(ok, detail)`` — HEAD first, GET fallback (some agency sites reject HEAD)."""
    try:
        with httpx.Client(follow_redirects=True, timeout=TIMEOUT) as client:
            resp = client.head(url)
            if resp.status_code in (403, 405) or resp.status_code >= 500:
                resp = client.get(url)
        return resp.status_code < 400, str(resp.status_code)
    except httpx.HTTPError as exc:
        return False, exc.__class__.__name__


class Command(BaseCommand):
    help = "Check published scenarios' source links and verification age (E4)."

    def handle(self, *args, **opts):
        broken = 0
        stale = 0
        for scenario in Scenario.objects.filter(is_published=True).order_by("slug"):
            if scenario.source_url:
                ok, detail = check_url(scenario.source_url)
                if not ok:
                    broken += 1
                    self.stdout.write(f"BROKEN  {scenario.slug}  {scenario.source_url}  ({detail})")
            if is_stale(scenario):
                stale += 1
                self.stdout.write(f"STALE   {scenario.slug}  verified_at={scenario.verified_at}")
        self.stdout.write(f"{broken} broken link(s), {stale} stale scenario(s).")
        if broken:
            raise CommandError(f"{broken} broken source link(s)")
