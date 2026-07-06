"""A2 — 👍/👎 feedback on assistant messages: owner-only idempotent upsert."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message, MessageFeedback

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return User.objects.create_user(
        email="fb-owner@example.com", full_name="Owner", password="pw-123-strong"
    )


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.fixture
def assistant_message(owner):
    conv = Conversation.objects.create(user=owner, language="en")
    Message.objects.create(conversation=conv, role=Message.USER, content="Question?")
    return Message.objects.create(
        conversation=conv, role=Message.ASSISTANT, content="Answer."
    )


def test_create_feedback(owner_client, assistant_message):
    url = reverse("message-feedback", args=[assistant_message.id])
    resp = owner_client.post(url, {"rating": "up"}, format="json")

    assert resp.status_code == 201
    assert resp.json()["rating"] == "up"
    assert MessageFeedback.objects.filter(message=assistant_message).count() == 1


def test_feedback_upsert_is_idempotent(owner_client, assistant_message):
    url = reverse("message-feedback", args=[assistant_message.id])
    owner_client.post(url, {"rating": "up"}, format="json")

    resp = owner_client.post(
        url, {"rating": "down", "reason": "Outdated fee amount"}, format="json"
    )
    assert resp.status_code == 200  # updated, not duplicated

    feedback = MessageFeedback.objects.get(message=assistant_message)
    assert feedback.rating == "down"
    assert feedback.reason == "Outdated fee amount"
    assert MessageFeedback.objects.filter(message=assistant_message).count() == 1


def test_invalid_rating_rejected(owner_client, assistant_message):
    url = reverse("message-feedback", args=[assistant_message.id])
    resp = owner_client.post(url, {"rating": "meh"}, format="json")
    assert resp.status_code == 400


def test_only_owner_can_rate(assistant_message):
    stranger = User.objects.create_user(
        email="fb-stranger@example.com", full_name="X", password="pw-123-strong"
    )
    client = APIClient()
    client.force_authenticate(user=stranger)

    url = reverse("message-feedback", args=[assistant_message.id])
    resp = client.post(url, {"rating": "up"}, format="json")
    assert resp.status_code == 404
    assert not MessageFeedback.objects.exists()


def test_user_messages_cannot_be_rated(owner_client, assistant_message):
    user_message = assistant_message.conversation.messages.get(role=Message.USER)
    url = reverse("message-feedback", args=[user_message.id])
    resp = owner_client.post(url, {"rating": "up"}, format="json")
    assert resp.status_code == 404


def test_anonymous_rejected(assistant_message):
    url = reverse("message-feedback", args=[assistant_message.id])
    resp = APIClient().post(url, {"rating": "up"}, format="json")
    assert resp.status_code == 401


def test_feedback_included_in_conversation_detail(owner_client, assistant_message):
    owner_client.post(
        reverse("message-feedback", args=[assistant_message.id]),
        {"rating": "up"},
        format="json",
    )

    resp = owner_client.get(
        reverse("conversation-detail", args=[assistant_message.conversation_id])
    )
    assert resp.status_code == 200
    messages = resp.json()["messages"]
    by_role = {m["role"]: m for m in messages}
    assert by_role["assistant"]["feedback"]["rating"] == "up"
    assert by_role["user"]["feedback"] is None
