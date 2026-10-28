import json
from io import StringIO

import pytest
from django.core.management import call_command

from scenarios.management.commands.apply_content_updates import DATA_FILE
from scenarios.management.commands.seed_scenarios import SCENARIOS
from scenarios.models import Scenario, ScenarioRevision

pytestmark = pytest.mark.django_db

ENTRIES = json.loads(DATA_FILE.read_text(encoding="utf-8"))
# A slug whose entry carries a non-empty checklist.
CL_ENTRY = next(e for e in ENTRIES if e["checklist"]["ru"])
URL_ONLY = next(e for e in ENTRIES if not e["checklist"]["ru"])


def run():
    out = StringIO()
    call_command("apply_content_updates", stdout=out)
    return out.getvalue()


@pytest.fixture(autouse=True)
def seeded():
    call_command("seed_scenarios", stdout=StringIO())


def test_applies_url_and_checklist_and_one_revision():
    s = Scenario.objects.get(slug=CL_ENTRY["slug"])
    assert s.checklist == {"uz": [], "ru": [], "en": []}
    before = ScenarioRevision.objects.filter(scenario=s).count()
    out = run()
    s.refresh_from_db()
    assert s.source_url == CL_ENTRY["source_url"]
    assert s.checklist == CL_ENTRY["checklist"]
    assert ScenarioRevision.objects.filter(scenario=s).count() == before + 1
    rev = ScenarioRevision.objects.filter(scenario=s).first()
    assert rev.data["source_url"] != CL_ENTRY["source_url"]
    assert s.status == "published" and s.is_published is True
    assert s.verified_at is None
    assert "updated" in out and "unchanged" in out and "skipped" in out


def test_second_run_is_noop():
    run()
    count = ScenarioRevision.objects.count()
    snap = {s.slug: (s.source_url, s.checklist) for s in Scenario.objects.all()}
    out = run()
    assert "updated 0" in out
    assert ScenarioRevision.objects.count() == count
    assert snap == {s.slug: (s.source_url, s.checklist) for s in Scenario.objects.all()}


def test_editor_changes_not_overwritten():
    s = Scenario.objects.get(slug=CL_ENTRY["slug"])
    s.source_url = "https://example.gov.uz/editor"
    s.checklist = {"uz": ["a"], "ru": ["б"], "en": ["c"]}
    s.save()
    t = Scenario.objects.get(slug=URL_ONLY["slug"])
    t.source_url = "https://example.gov.uz/other"
    t.save()
    run()
    s.refresh_from_db()
    t.refresh_from_db()
    assert s.source_url == "https://example.gov.uz/editor"
    assert s.checklist == {"uz": ["a"], "ru": ["б"], "en": ["c"]}
    assert t.source_url == "https://example.gov.uz/other"
    assert not ScenarioRevision.objects.filter(scenario__in=[s, t]).exists()


def test_data_file_integrity():
    seed_slugs = {s["slug"] for s in SCENARIOS}
    assert len({e["slug"] for e in ENTRIES}) == len(ENTRIES)
    for e in ENTRIES:
        assert e["slug"] in seed_slugs
        assert e["source_url"].startswith("https://")
        cl = e["checklist"]
        assert set(cl) == {"uz", "ru", "en"}
        assert len(cl["uz"]) == len(cl["ru"]) == len(cl["en"])
        assert all(isinstance(x, str) and x for lang in cl.values() for x in lang)
        assert len(e["evidence"]) == len(cl["ru"])
