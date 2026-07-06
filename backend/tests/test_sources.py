"""B1 — structured sources attached to assistant responses (JSON + SSE).

Runs in mock mode (no OpenAI key), so retrieval uses the keyword fallback — which is
exactly the grounded-without-a-key behavior the product promises (PRD D3).
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation
from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def auth_client():
    user = User.objects.create_user(
        email="sources@example.com", full_name="S", password="pw-123-strong"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def passport_scenario():
    cat = Category.objects.create(
        slug="documents",
        name={"uz": "Hujjatlar", "ru": "Документы", "en": "Documents"},
        order=1,
    )
    return Scenario.objects.create(
        category=cat,
        slug="passport-renewal",
        title={"uz": "Pasport", "ru": "Паспорт", "en": "Passport renewal"},
        body={
            "uz": "Pasportni yangilash tartibi.",
            "ru": "Порядок обновления паспорта.",
            "en": "To renew your passport, apply at the migration office.",
        },
        source_url="https://gov.uz/passport",
        is_published=True,
    )


def test_json_response_includes_structured_sources(auth_client, passport_scenario):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-create", args=[conv.id])

    resp = client.post(
        url, {"content": "How do I renew my passport?", "language": "en"}, format="json"
    )
    assert resp.status_code == 201
    sources = resp.json()["sources"]
    assert sources == [
        {
            "slug": "passport-renewal",
            "title": "Passport renewal",
            "source_url": "https://gov.uz/passport",
        }
    ]


def test_sources_empty_when_ungrounded(auth_client, passport_scenario):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-create", args=[conv.id])

    resp = client.post(
        url, {"content": "qqqq zzzz nothing relevant here", "language": "en"}, format="json"
    )
    assert resp.status_code == 201
    assert resp.json()["sources"] == []


def test_stream_emits_sources_frame_before_done(auth_client, passport_scenario):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-stream", args=[conv.id])

    resp = client.post(
        url, {"content": "How do I renew my passport?", "language": "en"}, format="json"
    )
    assert resp.status_code == 200
    body = b"".join(resp.streaming_content).decode()

    assert "event: sources" in body
    assert "passport-renewal" in body
    assert body.index("event: sources") < body.index("event: done")


def test_stream_sources_frame_empty_when_ungrounded(auth_client, passport_scenario):
    client, user = auth_client
    conv = Conversation.objects.create(user=user, language="en")
    url = reverse("message-stream", args=[conv.id])

    resp = client.post(
        url, {"content": "qqqq zzzz nothing relevant here", "language": "en"}, format="json"
    )
    body = b"".join(resp.streaming_content).decode()
    assert "event: sources\ndata: []" in body
