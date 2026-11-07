"""Search relevance, excerpt, body-heading cleanup and public caching headers."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from scenarios.models import Category, Scenario
from scenarios.serializers import make_excerpt, strip_leading_title_heading

pytestmark = pytest.mark.django_db


def _mk(cat, slug, title, body, tags=(), order=1):
    return Scenario.objects.create(
        category=cat, slug=slug, title=title, body=body, tags=list(tags),
        order=order, is_published=True,
    )


@pytest.fixture
def catalog():
    cat = Category.objects.create(slug="docs", name={"en": "Docs"}, order=1)
    # Listed first on purpose: catalog order alone would put it above the passport ones.
    _mk(cat, "marriage-registration",
        {"uz": "Nikoh ro'yxatidan o'tish", "ru": "Регистрация брака", "en": "Marriage registration"},
        {"uz": "Kerakli hujjatlar: pasport, ariza.", "ru": "Нужны документы: паспорт, заявление.",
         "en": "Documents required: passport, application."}, tags=["nikoh"], order=1)
    _mk(cat, "passport-renewal",
        {"uz": "Pasportni almashtirish", "ru": "Замена паспорта", "en": "Passport renewal"},
        {"uz": "Pasport muddati tugasa.", "ru": "Если паспорт истёк.", "en": "If your passport expired."},
        tags=["pasport"], order=2)
    _mk(cat, "passport-lost",
        {"uz": "Yo'qolgan pasport", "ru": "Утерян паспорт", "en": "Lost passport"},
        {"uz": "Pasport yo'qolsa.", "ru": "Если потеряли паспорт.", "en": "If you lost it."},
        tags=["yo'qolgan"], order=3)
    _mk(cat, "tourist-visa",
        {"uz": "Sayyohlik vizasi", "ru": "Туристическая виза", "en": "Tourist visa"},
        {"uz": "E-VISA orqali viza.", "ru": "Виза через E-VISA.", "en": "Apply for a visa online."},
        tags=["viza", "visa"], order=4)
    return cat


def _slugs(client, **params):
    resp = client.get(reverse("scenario-list"), params)
    assert resp.status_code == 200
    data = resp.json()
    rows = data["results"] if isinstance(data, dict) else data
    return [r["slug"] for r in rows]


def test_pasport_returns_passport_scenarios_first_without_marriage(catalog):
    slugs = _slugs(APIClient(), search="pasport", lang="uz")
    assert slugs[:2] == ["passport-renewal", "passport-lost"]
    assert "marriage-registration" not in slugs


def test_viza_with_lang_ru_finds_tourist_visa(catalog):
    assert "tourist-visa" in _slugs(APIClient(), search="viza", lang="ru")


def test_cyrillic_query_with_lang_uz_finds_passport(catalog):
    slugs = _slugs(APIClient(), search="паспорт", lang="uz")
    assert "passport-renewal" in slugs and "passport-lost" in slugs
    assert slugs[0] in {"passport-renewal", "passport-lost"}


def test_response_is_localized_in_requested_lang_even_if_matched_in_other(catalog):
    resp = APIClient().get(reverse("scenario-list"), {"search": "паспорт", "lang": "uz"})
    data = resp.json()
    rows = data["results"] if isinstance(data, dict) else data
    titles = {r["slug"]: r["title"] for r in rows}
    assert titles["passport-renewal"] == "Pasportni almashtirish"


def test_multiword_query_requires_all_terms(catalog):
    assert _slugs(APIClient(), search="lost passport", lang="en") == ["passport-lost"]
    assert _slugs(APIClient(), search="passport zebra", lang="en") == []


def test_body_only_matches_dropped_when_title_or_tag_matches(catalog):
    # "passport" is only in the body of marriage-registration.
    slugs = _slugs(APIClient(), search="passport", lang="en")
    assert "marriage-registration" not in slugs
    assert set(slugs) == {"passport-renewal", "passport-lost"}


def test_body_only_matches_kept_when_nothing_else_matches(catalog):
    assert _slugs(APIClient(), search="application", lang="en") == ["marriage-registration"]


def test_search_capped_to_twelve(catalog):
    cat = Category.objects.get(slug="docs")
    for i in range(20):
        _mk(cat, f"extra-{i}", {"en": f"Zeta service {i}"}, {"en": "x"}, order=10 + i)
    resp = APIClient().get(reverse("scenario-list"), {"search": "zeta", "lang": "en"})
    data = resp.json()
    rows = data["results"] if isinstance(data, dict) else data
    assert len(rows) == 12


def test_apostrophe_variants_still_match(catalog):
    assert "passport-lost" in _slugs(APIClient(), search="yoʻqolgan", lang="uz")


# ---- excerpt -------------------------------------------------------------
def test_excerpt_strips_markdown_and_leading_title_line():
    body = "## Passport renewal\n\n**Apply** at the *office* with `form`.\n\n- bring photo"
    out = make_excerpt(body, "Passport renewal")
    assert out.startswith("Apply at the office with form")
    assert "#" not in out and "*" not in out and "`" not in out
    assert "Passport renewal" not in out


def test_excerpt_keeps_non_title_first_line_and_truncates():
    out = make_excerpt("Intro text. " + "word " * 80, "Other title")
    assert out.startswith("Intro text.")
    assert len(out) <= 161 and out.endswith("…")


@pytest.mark.parametrize("body, expected", [
    ("## Kompaniyani tugatish\n**Kim uchun:** faoliyatni to'xtatmoqchi bo'lgan ta'sischilar.\n**Qadamlar:**\n1. Qaror qabul qiling.",
     "Faoliyatni to'xtatmoqchi bo'lgan ta'sischilar."),
    ("## Смена адреса\n\n**Что это:** Обновление регистрации при переезде.\n\n**Как оформить:**\n1. Обратитесь.",
     "Обновление регистрации при переезде."),
    ("## Changing your address\n\n**What it is:** Updating your registration.\n\n**How:**\n1. Apply.",
     "Updating your registration."),
    ("# Haydovchilik guvohnomasi\n## Yangi guvohnoma\nYangi guvohnoma olish uchun ariza bering.",
     "Yangi guvohnoma olish uchun ariza bering."),
])
def test_excerpt_skips_headings_and_leading_label(body, expected):
    # Heading text deliberately differs from the title: every heading line is skipped.
    assert make_excerpt(body, "Other title").startswith(expected)


def test_excerpt_keeps_long_or_sentence_prefix_before_colon():
    long_label = "Bu juda uzun sarlavha emas lekin ko'p so'z: matn"
    assert make_excerpt(long_label) == long_label
    sentence = "Hujjatlar tayyor bo'lsa. Keyin: ariza bering"
    assert make_excerpt(sentence) == sentence


def test_list_api_excerpt_does_not_repeat_title(catalog):
    s = Scenario.objects.get(slug="passport-renewal")
    s.body = {**s.body, "en": "# Passport renewal\nGo to the office."}
    s.save()
    resp = APIClient().get(reverse("scenario-list"), {"search": "passport renewal", "lang": "en"})
    data = resp.json()
    rows = data["results"] if isinstance(data, dict) else data
    assert rows[0]["excerpt"] == "Go to the office."


# ---- detail body ---------------------------------------------------------
def test_strip_leading_title_heading_variants():
    assert strip_leading_title_heading("## Tourist visa\n\nText", "Tourist visa") == "Text"
    assert strip_leading_title_heading("# **Tourist visa**\nText", "tourist visa") == "Text"
    # Different heading or non-heading first line stays untouched.
    assert strip_leading_title_heading("## Steps\nText", "Tourist visa") == "## Steps\nText"
    assert strip_leading_title_heading("Tourist visa\nText", "Tourist visa") == "Tourist visa\nText"


def test_detail_body_drops_duplicate_h1(catalog):
    s = Scenario.objects.get(slug="tourist-visa")
    s.body = {**s.body, "en": "## Tourist visa\n\n## Steps\n1. Apply"}
    s.save()
    resp = APIClient().get(reverse("scenario-detail", args=["tourist-visa"]), {"lang": "en"})
    assert resp.json()["body"] == "## Steps\n1. Apply"


# ---- caching -------------------------------------------------------------
def test_public_scenario_endpoints_are_cacheable(catalog):
    client = APIClient()
    for url in (
        reverse("scenario-list"),
        reverse("scenario-detail", args=["tourist-visa"]),
        reverse("category-list"),
    ):
        assert client.get(url).headers["Cache-Control"] == "public, max-age=300", url


def test_non_public_endpoints_not_marked_cacheable(catalog):
    client = APIClient()
    assert "public" not in client.get("/api/config/").headers.get("Cache-Control", "")
    assert "public" not in client.get("/api/health/llm/").headers.get("Cache-Control", "")
    assert client.get("/api/admin/scenarios/").status_code in (401, 403)
    assert "public" not in client.get("/api/admin/scenarios/").headers.get("Cache-Control", "")
