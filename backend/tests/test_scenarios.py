import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from scenarios.models import Category, Scenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog():
    cat = Category.objects.create(
        slug="visa-migration",
        icon="✈️",
        name={"uz": "Viza", "ru": "Виза", "en": "Visa"},
        description={"uz": "", "ru": "", "en": ""},
        order=1,
    )
    Scenario.objects.create(
        category=cat,
        slug="tourist-visa",
        title={"uz": "Sayyohlik vizasi", "ru": "Туристическая виза", "en": "Tourist visa"},
        body={"uz": "matn", "ru": "текст", "en": "Apply on the E-VISA portal."},
        tags=["visa", "tourist"],
        is_published=True,
    )
    Scenario.objects.create(
        category=cat,
        slug="hidden",
        title={"uz": "x", "ru": "x", "en": "Hidden one"},
        body={"uz": "x", "ru": "x", "en": "x"},
        is_published=False,
    )
    return cat


def test_categories_localized_to_requested_lang(catalog):
    resp = APIClient().get(reverse("category-list"), {"lang": "ru"})
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["name"] == "Виза"
    assert data[0]["scenario_count"] == 1  # excludes unpublished


def test_scenario_list_public_and_excludes_unpublished(catalog):
    resp = APIClient().get(reverse("scenario-list"), {"lang": "en"})
    assert resp.status_code == 200
    slugs = [s["slug"] for s in resp.json()]
    assert "tourist-visa" in slugs
    assert "hidden" not in slugs


def test_scenario_filter_by_category_and_search(catalog):
    resp = APIClient().get(
        reverse("scenario-list"), {"lang": "en", "category": "visa-migration", "search": "E-VISA"}
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_scenario_detail_localized(catalog):
    resp = APIClient().get(reverse("scenario-detail", args=["tourist-visa"]), {"lang": "en"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Tourist visa"
    assert "E-VISA" in data["body"]


def test_unpublished_detail_404(catalog):
    resp = APIClient().get(reverse("scenario-detail", args=["hidden"]), {"lang": "en"})
    assert resp.status_code == 404


def test_lang_fallback(catalog):
    # Request a language missing for the field -> falls back, never errors.
    resp = APIClient().get(reverse("scenario-detail", args=["tourist-visa"]), {"lang": "zz"})
    assert resp.status_code == 200
