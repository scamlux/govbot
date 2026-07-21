import pytest
from django.test import override_settings
from rest_framework.test import APIClient

URL = "/api/internal/kb/tick/"


@pytest.fixture
def client():
    return APIClient()


@override_settings(KB_TICK_SECRET="s3cr3t")
@pytest.mark.django_db
def test_missing_secret_forbidden(client):
    assert client.post(URL).status_code == 403


@override_settings(KB_TICK_SECRET="s3cr3t")
@pytest.mark.django_db
def test_wrong_secret_forbidden(client):
    resp = client.post(URL, HTTP_X_KB_TICK_SECRET="nope")
    assert resp.status_code == 403


@override_settings(KB_TICK_SECRET="s3cr3t")
@pytest.mark.django_db
def test_correct_secret_runs_tick(client):
    resp = client.post(URL, HTTP_X_KB_TICK_SECRET="s3cr3t")
    assert resp.status_code == 200
    assert set(resp.json()) == {"processed", "failed"}


@override_settings(KB_TICK_SECRET="")
@pytest.mark.django_db
def test_unset_secret_refuses_all(client):
    assert client.post(URL, HTTP_X_KB_TICK_SECRET="anything").status_code == 403
