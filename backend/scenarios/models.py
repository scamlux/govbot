from django.db import models

LANGUAGE_CODES = ("uz", "ru", "en")
# Fallback order used when a requested language is missing for a field.
FALLBACK_ORDER = ("uz", "en", "ru")


def localize(translations: dict | None, lang: str) -> str:
    """Resolve a multilingual {uz,ru,en} dict to a single string for `lang`.

    Falls back: requested -> uz -> en -> ru -> first non-empty -> "".
    """
    if not translations:
        return ""
    if translations.get(lang):
        return translations[lang]
    for code in FALLBACK_ORDER:
        if translations.get(code):
            return translations[code]
    for value in translations.values():
        if value:
            return value
    return ""


def empty_translations() -> dict:
    return {code: "" for code in LANGUAGE_CODES}


class Category(models.Model):
    slug = models.SlugField(max_length=100, unique=True)
    icon = models.CharField(
        max_length=50, blank=True, help_text="Emoji or icon name, e.g. 🛂"
    )
    name = models.JSONField(
        default=empty_translations, help_text='{"uz": "...", "ru": "...", "en": "..."}'
    )
    description = models.JSONField(default=empty_translations, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "slug"]
        verbose_name_plural = "categories"

    def __str__(self):
        return f"{self.icon} {localize(self.name, 'en') or self.slug}".strip()


class Scenario(models.Model):
    category = models.ForeignKey(
        Category, related_name="scenarios", on_delete=models.CASCADE
    )
    slug = models.SlugField(max_length=120, unique=True)
    title = models.JSONField(default=empty_translations)
    body = models.JSONField(
        default=empty_translations, help_text="Markdown-capable, per language."
    )
    tags = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self):
        return localize(self.title, "en") or self.slug
