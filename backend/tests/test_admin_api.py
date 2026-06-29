import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client():
    admin = User.objects.create_superuser(email="admin@example.com", password="Adm!n12345")
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def user_client():
    user = User.objects.create_user(email="plain@example.com", password="Us3r!12345")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_admin_users_list_requires_staff(user_client):
    assert user_client.get("/api/admin/users/").status_code == 403


def test_admin_users_list_for_staff(admin_client):
    resp = admin_client.get("/api/admin/users/")
    assert resp.status_code == 200
    assert any(u["email"] == "admin@example.com" for u in resp.json())


def test_admin_create_category_with_translations(admin_client):
    payload = {
        "slug": "new-cat",
        "icon": "📦",
        "name": {"uz": "Yangi", "ru": "Новый", "en": "New"},
        "description": {"en": "desc"},
        "order": 5,
    }
    resp = admin_client.post("/api/admin/categories/", payload, format="json")
    assert resp.status_code == 201
    cat = Category.objects.get(slug="new-cat")
    assert cat.name["ru"] == "Новый"
    # Missing languages are coerced to empty strings, never KeyError.
    assert cat.description["uz"] == ""


def test_admin_scenario_crud(admin_client):
    cat = Category.objects.create(
        slug="c", name={"uz": "", "ru": "", "en": "C"}, order=1
    )
    create = admin_client.post(
        "/api/admin/scenarios/",
        {
            "category": cat.id,
            "slug": "s1",
            "title": {"uz": "", "ru": "", "en": "Title"},
            "body": {"uz": "", "ru": "", "en": "Body"},
            "tags": ["a", "b"],
            "order": 1,
            "is_published": True,
        },
        format="json",
    )
    assert create.status_code == 201
    sid = create.json()["id"]

    patch = admin_client.patch(
        f"/api/admin/scenarios/{sid}/", {"is_published": False}, format="json"
    )
    assert patch.status_code == 200
    assert Scenario.objects.get(id=sid).is_published is False

    delete = admin_client.delete(f"/api/admin/scenarios/{sid}/")
    assert delete.status_code == 204
    assert not Scenario.objects.filter(id=sid).exists()


def test_admin_category_write_blocked_for_non_staff(user_client):
    resp = user_client.post("/api/admin/categories/", {"slug": "x"}, format="json")
    assert resp.status_code == 403


def test_category_order_auto_increments_when_omitted(admin_client):
    Category.objects.create(slug="a", name={"uz": "", "ru": "", "en": "A"}, order=3)
    resp = admin_client.post(
        "/api/admin/categories/",
        {"slug": "b", "name": {"uz": "", "ru": "", "en": "B"}},  # no order
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["order"] == 4  # max(3) + 1


def test_scenario_order_auto_increments_within_category(admin_client):
    cat = Category.objects.create(slug="c", name={"uz": "", "ru": "", "en": "C"}, order=1)
    Scenario.objects.create(
        category=cat, slug="s0", title={"en": "x"}, body={"en": "x"}, order=7
    )
    resp = admin_client.post(
        "/api/admin/scenarios/",
        {
            "category": cat.id,
            "slug": "s1",
            "title": {"uz": "", "ru": "", "en": "T"},
            "body": {"uz": "", "ru": "", "en": "B"},
        },  # no order
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["order"] == 8  # max(7) + 1 within the category
