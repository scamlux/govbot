"""The seed runs on every deploy (entrypoint.sh) and must never clobber editor work."""
from io import StringIO

import pytest
from django.core.management import call_command

from scenarios.models import Scenario

pytestmark = pytest.mark.django_db


def _seed(*args):
    call_command("seed_scenarios", *args, stdout=StringIO())


def test_seed_preserves_admin_edits_and_status():
    _seed()
    s = Scenario.objects.get(slug="tourist-visa")
    s.source_url = "https://e-visa.gov.uz/edited"
    s.title = {**s.title, "en": "Edited title"}
    s.set_status(Scenario.STATUS_REVIEW)
    s.save()

    _seed()  # simulates the next deploy
    s.refresh_from_db()
    assert s.source_url == "https://e-visa.gov.uz/edited"
    assert s.title["en"] == "Edited title"
    assert s.status == Scenario.STATUS_REVIEW
    assert s.is_published is False


def test_seed_backfills_only_empty_fields_and_creates_missing():
    _seed()
    s = Scenario.objects.get(slug="tourist-visa")
    Scenario.objects.filter(pk=s.pk).update(audience=[])
    Scenario.objects.filter(slug="citizenship").delete()

    _seed()
    s.refresh_from_db()
    assert "tourist" in s.audience
    assert Scenario.objects.filter(slug="citizenship").exists()


def test_seed_does_not_republish_a_draft():
    _seed()
    s = Scenario.objects.get(slug="citizenship")
    s.set_status(Scenario.STATUS_DRAFT)
    s.save()
    _seed()
    s.refresh_from_db()
    assert s.status == Scenario.STATUS_DRAFT and s.is_published is False


def test_seed_reset_restores_seed_text():
    _seed()
    Scenario.objects.filter(slug="tourist-visa").update(source_url="https://x.example")
    _seed("--reset")
    assert Scenario.objects.get(slug="tourist-visa").source_url == "https://e-visa.gov.uz"
