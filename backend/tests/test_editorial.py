"""E1 status workflow, E2 revisions, E4 stale report, A3/C1/B3 fields, R4 apostrophes,
E3 knowledge-base admin API, A8 gap clustering, A4 eval harness, F4 retention."""
import datetime
from datetime import timedelta
from io import StringIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from chat.analytics import cluster_questions
from chat.management.commands.eval_retrieval import evaluate
from chat.models import Conversation, Message
from knowledge.models import KnowledgeSource
from scenarios.models import Category, Scenario, ScenarioRevision

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff():
    user = User.objects.create_user(email="staff@example.com", password="pw-123-strong", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def category():
    return Category.objects.create(slug="docs", name={"en": "Docs"}, order=1)


def _scenario(category, slug="passport-renewal", **extra):
    defaults = dict(
        category=category,
        slug=slug,
        title={"en": "Passport renewal", "uz": "Pasportni almashtirish", "ru": "Замена паспорта"},
        body={"en": "Renew your passport at the migration office.", "uz": "O'zbekiston pasportini almashtirish."},
        source_url="https://gov.uz/passport",
    )
    defaults.update(extra)
    return Scenario.objects.create(**defaults)


# ---------------------------------------------------------------------------
# E1 — status workflow keeps is_published consistent
# ---------------------------------------------------------------------------
def test_legacy_is_published_drives_status(category):
    s = _scenario(category, is_published=False)
    assert s.status == Scenario.STATUS_DRAFT
    s.is_published = True
    s.save()
    assert s.status == Scenario.STATUS_PUBLISHED


def test_set_status_drives_visibility(category):
    s = _scenario(category)
    s.set_status(Scenario.STATUS_REVIEW)
    s.save()
    s.refresh_from_db()
    assert s.is_published is False and s.status == "review"
    assert APIClient().get(reverse("scenario-detail", args=[s.slug])).status_code == 404


def test_admin_api_sets_status(staff, category):
    s = _scenario(category)
    resp = staff.patch(reverse("admin-scenario-detail", args=[s.id]), {"status": "draft"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["is_published"] is False
    resp = staff.patch(reverse("admin-scenario-detail", args=[s.id]), {"status": "published"}, format="json")
    assert resp.json()["is_published"] is True


def test_admin_filter_by_status(staff, category):
    _scenario(category, slug="a")
    _scenario(category, slug="b", is_published=False)
    data = staff.get(reverse("admin-scenario-list"), {"status": "draft"}).json()
    rows = data["results"] if isinstance(data, dict) else data
    assert [r["slug"] for r in rows] == ["b"]


# ---------------------------------------------------------------------------
# E2 — revisions + restore
# ---------------------------------------------------------------------------
def test_update_creates_revision_and_restore_rolls_back(staff, category):
    s = _scenario(category)
    url = reverse("admin-scenario-detail", args=[s.id])
    staff.patch(url, {"source_url": "https://gov.uz/new"}, format="json")
    revisions = staff.get(reverse("admin-scenario-revisions", args=[s.id])).json()
    assert len(revisions) == 1
    assert revisions[0]["data"]["source_url"] == "https://gov.uz/passport"
    assert revisions[0]["author_email"] == "staff@example.com"

    resp = staff.post(reverse("admin-scenario-restore", args=[s.id, revisions[0]["id"]]))
    assert resp.status_code == 200
    s.refresh_from_db()
    assert s.source_url == "https://gov.uz/passport"
    # The restore itself is undoable.
    assert ScenarioRevision.objects.filter(scenario=s).count() == 2


# ---------------------------------------------------------------------------
# A3 / C1 / B3 — public fields
# ---------------------------------------------------------------------------
def test_detail_exposes_verified_at_checklist_and_audience(category):
    s = _scenario(
        category,
        verified_at=datetime.date(2026, 10, 1),
        checklist={"en": ["Old passport", "Photo"], "ru": [], "uz": []},
        audience=["citizen"],
    )
    data = APIClient().get(reverse("scenario-detail", args=[s.slug]), {"lang": "ru"}).json()
    assert data["verified_at"] == "2026-10-01"
    assert data["checklist"] == ["Old passport", "Photo"]  # ru empty → falls back
    assert data["audience"] == ["citizen"]
    assert data["source_url"] == "https://gov.uz/passport"


def test_admin_checklist_rejects_unknown_language(staff, category):
    s = _scenario(category)
    resp = staff.patch(
        reverse("admin-scenario-detail", args=[s.id]), {"checklist": {"fr": ["x"]}}, format="json"
    )
    assert resp.status_code == 400


def test_audience_filter_keeps_universal_scenarios(category):
    _scenario(category, slug="for-tourists", audience=["tourist"])
    _scenario(category, slug="for-citizens", audience=["citizen"])
    _scenario(category, slug="for-everyone", audience=[])
    data = APIClient().get(reverse("scenario-list"), {"audience": "tourist"}).json()
    rows = data["results"] if isinstance(data, dict) else data
    slugs = sorted(r["slug"] for r in rows)
    assert slugs == ["for-everyone", "for-tourists"]


# ---------------------------------------------------------------------------
# R4 — apostrophe-insensitive search
# ---------------------------------------------------------------------------
def test_search_folds_uzbek_apostrophes(category):
    _scenario(category)
    data = APIClient().get(reverse("scenario-list"), {"lang": "uz", "search": "Oʻzbekiston"}).json()
    rows = data["results"] if isinstance(data, dict) else data
    assert [r["slug"] for r in rows] == ["passport-renewal"]


def test_search_matches_okina_text_typed_with_ascii(category):
    # The reverse of R4: catalog text in the correct ʻ (U+02BB), user types a plain '.
    _scenario(category, body={"uz": "Davlat bojini toʻlang."})
    for q in ("to'lang", "toʻlang", "to’lang"):
        data = APIClient().get(reverse("scenario-list"), {"lang": "uz", "search": q}).json()
        rows = data["results"] if isinstance(data, dict) else data
        assert [r["slug"] for r in rows] == ["passport-renewal"], q


# ---------------------------------------------------------------------------
# E4 — stale report + link checker
# ---------------------------------------------------------------------------
@override_settings(SCENARIO_STALE_DAYS=90)
def test_stale_report(staff, category):
    _scenario(category, slug="fresh", verified_at=timezone.now().date())
    _scenario(category, slug="old", verified_at=timezone.now().date() - timedelta(days=200))
    _scenario(category, slug="never")
    data = staff.get(reverse("admin-scenario-stale")).json()
    assert data["count"] == 2
    assert sorted(s["slug"] for s in data["scenarios"]) == ["never", "old"]


def test_check_scenario_links_reports_broken(category, monkeypatch):
    _scenario(category, verified_at=timezone.now().date())
    monkeypatch.setattr(
        "scenarios.management.commands.check_scenario_links.check_url",
        lambda url: (False, "404"),
    )
    out = StringIO()
    with pytest.raises(Exception):
        call_command("check_scenario_links", stdout=out)
    assert "BROKEN  passport-renewal" in out.getvalue()


# ---------------------------------------------------------------------------
# E3 — knowledge base admin API
# ---------------------------------------------------------------------------
def test_kb_api_requires_staff():
    assert APIClient().get(reverse("admin-kb-source-list")).status_code == 401


def test_kb_api_create_paste_and_reindex(staff):
    resp = staff.post(
        reverse("admin-kb-source-list"),
        {"source_type": "paste", "title": "Notes", "raw_text": "Some official text."},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    source = KnowledgeSource.objects.get(pk=body["id"])
    source.status = KnowledgeSource.STATUS_INDEXED
    source.save()
    resp = staff.post(reverse("admin-kb-source-reindex", args=[source.id]))
    assert resp.status_code == 202
    assert resp.json()["status"] == "pending"


def test_kb_api_upload_txt_parses_and_discards_file(staff):
    upload = SimpleUploadedFile("guide.txt", "Hello from a file".encode(), content_type="text/plain")
    resp = staff.post(
        reverse("admin-kb-source-list"),
        {"source_type": "txt", "title": "Guide", "upload": upload},
        format="multipart",
    )
    assert resp.status_code == 201
    source = KnowledgeSource.objects.get(pk=resp.json()["id"])
    assert source.raw_text.strip() == "Hello from a file"
    assert source.original_filename == "guide.txt"


def test_kb_api_validates_inputs(staff):
    assert staff.post(reverse("admin-kb-source-list"), {"source_type": "url"}, format="json").status_code == 400
    assert staff.post(reverse("admin-kb-source-list"), {"source_type": "paste"}, format="json").status_code == 400
    assert staff.post(reverse("admin-kb-source-list"), {"source_type": "pdf"}, format="json").status_code == 400


# ---------------------------------------------------------------------------
# A8 — paraphrase clustering
# ---------------------------------------------------------------------------
def test_cluster_questions_merges_paraphrases():
    groups = cluster_questions(
        [
            "How do I renew my passport?",
            "how do i renew my passport?",
            "Passport renewal process",
            "Where to pay traffic fines",
        ]
    )
    assert groups[0]["count"] == 3
    assert len(groups) == 2


# ---------------------------------------------------------------------------
# A4 — eval harness runs and finds the obvious case
# ---------------------------------------------------------------------------
def test_eval_harness_measures_recall(category):
    _scenario(category)
    result = evaluate([{"q": "renew my passport", "lang": "en", "expect": ["passport-renewal"]}])
    assert result["recall"] == 1.0 and result["misses"] == []


# ---------------------------------------------------------------------------
# F4 — retention purge + admin redaction
# ---------------------------------------------------------------------------
def test_purge_conversations_respects_window():
    user = User.objects.create_user(email="r@example.com", password="pw-123-strong")
    old = Conversation.objects.create(user=user, language="en")
    new = Conversation.objects.create(user=user, language="en")
    Conversation.objects.filter(pk=old.pk).update(updated_at=timezone.now() - timedelta(days=400))
    out = StringIO()
    call_command("purge_conversations", "--days", "365", stdout=out)
    assert not Conversation.objects.filter(pk=old.pk).exists()
    assert Conversation.objects.filter(pk=new.pk).exists()


def test_purge_disabled_by_default():
    out = StringIO()
    call_command("purge_conversations", stdout=out)
    assert "disabled" in out.getvalue()


@override_settings(ADMIN_CAN_READ_CONVERSATIONS=False)
def test_admin_conversation_bodies_can_be_redacted(staff):
    user = User.objects.create_user(email="c@example.com", password="pw-123-strong")
    conv = Conversation.objects.create(user=user, language="en")
    Message.objects.create(conversation=conv, role=Message.USER, content="my secret question")
    data = staff.get(reverse("admin-conversation-detail", args=[conv.id])).json()
    assert all(m["content"] == "[redacted]" for m in data["messages"])
