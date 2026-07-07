"""C1 — aggregate question analytics API."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message, MessageFeedback

pytestmark = pytest.mark.django_db

SRC = [
    {
        "slug": "passport-renewal",
        "title": "Passport renewal",
        "source_url": "https://gov.uz/passport",
    }
]


@pytest.fixture
def admin_client():
    admin = User.objects.create_superuser(email="a@ex.com", password="Adm!n12345")
    client = APIClient()
    client.force_authenticate(admin)
    return client


def _assistant(conv, sources):
    return Message.objects.create(
        conversation=conv, role=Message.ASSISTANT, content="a", sources=sources
    )


def test_analytics_requires_staff():
    user = User.objects.create_user(email="u@ex.com", password="Us3r!12345")
    client = APIClient()
    client.force_authenticate(user)
    assert client.get("/api/admin/analytics/questions/").status_code == 403


def test_analytics_aggregates(admin_client):
    owner = User.objects.create_user(email="o@ex.com", password="Us3r!12345")
    conv_uz = Conversation.objects.create(user=owner, language="uz")
    conv_ru = Conversation.objects.create(user=owner, language="ru")
    Message.objects.create(conversation=conv_uz, role=Message.USER, content="q1")
    Message.objects.create(conversation=conv_uz, role=Message.USER, content="q2")
    Message.objects.create(conversation=conv_ru, role=Message.USER, content="q3")

    _assistant(conv_uz, SRC)
    _assistant(conv_uz, SRC)
    _assistant(conv_ru, [])  # ungrounded → catalog-gap signal
    up_msg = _assistant(conv_ru, SRC)
    down_msg = _assistant(conv_ru, SRC)
    MessageFeedback.objects.create(message=up_msg, rating=MessageFeedback.UP)
    MessageFeedback.objects.create(message=down_msg, rating=MessageFeedback.DOWN)

    data = admin_client.get("/api/admin/analytics/questions/").json()

    assert data["totals"] == {"conversations": 2, "questions": 3, "answers": 5}

    langs = {r["language"]: r for r in data["by_language"]}
    assert langs["uz"] == {"language": "uz", "conversations": 1, "questions": 2}
    assert langs["ru"] == {"language": "ru", "conversations": 1, "questions": 1}

    assert data["grounding"]["grounded"] == 4
    assert data["grounding"]["ungrounded"] == 1
    assert data["grounding"]["rate"] == 0.8

    assert data["feedback"] == {"up": 1, "down": 1, "total": 2, "satisfaction": 0.5}

    top = data["top_topics"][0]
    assert top == {"slug": "passport-renewal", "title": "Passport renewal", "count": 4}


def test_analytics_respects_days_window(admin_client):
    owner = User.objects.create_user(email="o2@ex.com", password="Us3r!12345")
    conv = Conversation.objects.create(user=owner, language="uz")
    old = Message.objects.create(conversation=conv, role=Message.USER, content="old")
    Message.objects.filter(pk=old.pk).update(
        created_at=timezone.now() - timedelta(days=40)
    )
    Message.objects.create(conversation=conv, role=Message.USER, content="new")

    data = admin_client.get("/api/admin/analytics/questions/?days=30").json()
    assert data["totals"]["questions"] == 1  # the 40-day-old question is excluded


def test_analytics_empty_state(admin_client):
    data = admin_client.get("/api/admin/analytics/questions/").json()
    assert data["totals"] == {"conversations": 0, "questions": 0, "answers": 0}
    assert data["by_language"] == []
    assert data["top_topics"] == []
    assert data["feedback"]["satisfaction"] is None
    assert data["grounding"]["rate"] is None
