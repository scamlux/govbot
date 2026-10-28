"""One-shot, idempotent content update: official source URLs + document checklists.

Data lives in ``scenarios/content/official_sources_2026_10.json``. Safe to run on every
deploy: editor changes are never overwritten (see ``_plan``), and a second run is a no-op.
Never touches status / is_published / title / body / verified_at / tags / audience.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from scenarios.management.commands.seed_scenarios import SCENARIOS
from scenarios.models import Scenario, ScenarioRevision

DATA_FILE = Path(__file__).resolve().parents[2] / "content" / "official_sources_2026_10.json"
NOTE = "content update 2026-10 (official sources)"
LANGS = ("uz", "ru", "en")


def _checklist_empty(value) -> bool:
    if not value:
        return True
    return not any((value or {}).get(lang) for lang in LANGS)


class Command(BaseCommand):
    help = "Apply verified official source_url + document checklists (idempotent)."

    @staticmethod
    def _plan(scenario, entry, old_seed_url) -> dict:
        """Return the field changes allowed for this scenario (may be empty)."""
        changes = {}
        new_url = entry["source_url"]
        current = (scenario.source_url or "").strip()
        if current != new_url and (not current or current == old_seed_url):
            changes["source_url"] = new_url
        new_cl = entry.get("checklist") or {}
        if any(new_cl.get(lang) for lang in LANGS) and _checklist_empty(scenario.checklist):
            changes["checklist"] = {lang: list(new_cl.get(lang, [])) for lang in LANGS}
        return changes

    @transaction.atomic
    def handle(self, *args, **options):
        entries = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        old_urls = {s["slug"]: s.get("source_url", "") for s in SCENARIOS}
        updated = unchanged = skipped = 0
        for entry in entries:
            scenario = Scenario.objects.filter(slug=entry["slug"]).first()
            if scenario is None:
                skipped += 1
                self.stdout.write(f"  - skip {entry['slug']} (not found)")
                continue
            changes = self._plan(scenario, entry, old_urls.get(entry["slug"], ""))
            if not changes:
                unchanged += 1
                continue
            ScenarioRevision.objects.create(
                scenario=scenario, data=scenario.snapshot(), author_email="", note=NOTE
            )
            for field, value in changes.items():
                setattr(scenario, field, value)
            scenario.save(update_fields=[*changes, "updated_at"])
            updated += 1
            self.stdout.write(f"  ~ {scenario.slug}: {', '.join(changes)}")
        self.stdout.write(
            self.style.SUCCESS(f"updated {updated}, unchanged {unchanged}, skipped {skipped}")
        )
