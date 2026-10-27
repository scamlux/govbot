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


def empty_checklist() -> dict:
    return {code: [] for code in LANGUAGE_CODES}


class Scenario(models.Model):
    # E1 — editorial workflow. ``is_published`` stays the public-visibility switch the
    # rest of the code (and the seed) relies on; ``status`` is kept in sync on save.
    STATUS_DRAFT = "draft"
    STATUS_REVIEW = "review"
    STATUS_PUBLISHED = "published"
    STATUSES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_REVIEW, "In review"),
        (STATUS_PUBLISHED, "Published"),
    ]

    # B3 / R3 — who a scenario is mainly for (drives the role filter on the landing page).
    AUDIENCES = ("citizen", "resident", "tourist")

    category = models.ForeignKey(
        Category, related_name="scenarios", on_delete=models.CASCADE
    )
    slug = models.SlugField(max_length=120, unique=True)
    title = models.JSONField(default=empty_translations)
    body = models.JSONField(
        default=empty_translations, help_text="Markdown-capable, per language."
    )
    source_url = models.URLField(
        blank=True,
        help_text="Official source link (agency page) surfaced when the AI cites this scenario.",
    )
    tags = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    status = models.CharField(max_length=10, choices=STATUSES, default=STATUS_PUBLISHED)
    # A3 — when an editor last confirmed the content against the official source.
    verified_at = models.DateField(null=True, blank=True)
    # C1 — structured "documents to bring" list, per language: {"uz": [..], "ru": [..], ..}.
    # Only filled by editors from official sources; empty means "not structured yet".
    checklist = models.JSONField(default=empty_checklist, blank=True)
    # B3 — ["citizen" | "resident" | "tourist", ...]; empty = everyone.
    audience = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self):
        return localize(self.title, "en") or self.slug

    def embedding_source_text(self, lang: str) -> str:
        """Concatenated title + body for a language — the text we embed / keyword-match."""
        return "\n".join(
            part for part in (localize(self.title, lang), localize(self.body, lang)) if part
        ).strip()

    def save(self, *args, **kwargs):
        # E1 — keep the two visibility fields consistent. An explicit ``set_status`` wins;
        # otherwise (seed, legacy callers toggling ``is_published``) status follows it.
        if getattr(self, "_status_changed", False):
            self.is_published = self.status == self.STATUS_PUBLISHED
            self._status_changed = False
        elif self.is_published and self.status != self.STATUS_PUBLISHED:
            self.status = self.STATUS_PUBLISHED
        elif not self.is_published and self.status == self.STATUS_PUBLISHED:
            self.status = self.STATUS_DRAFT
        super().save(*args, **kwargs)

    def set_status(self, status: str) -> None:
        """Change the workflow status; visibility follows (published ⇔ visible)."""
        self.status = status
        self.is_published = status == self.STATUS_PUBLISHED
        self._status_changed = True

    def checklist_for(self, lang: str) -> list[str]:
        data = self.checklist or {}
        if data.get(lang):
            return list(data[lang])
        for code in FALLBACK_ORDER:
            if data.get(code):
                return list(data[code])
        return []

    def snapshot(self) -> dict:
        """E2 — the editable content of a scenario, for revision history."""
        return {
            "category_id": self.category_id,
            "title": self.title,
            "body": self.body,
            "source_url": self.source_url,
            "tags": self.tags,
            "status": self.status,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "checklist": self.checklist,
            "audience": self.audience,
        }


class ScenarioRevision(models.Model):
    """E2 — an immutable snapshot of a scenario taken before each admin edit."""

    scenario = models.ForeignKey(
        Scenario, related_name="revisions", on_delete=models.CASCADE
    )
    data = models.JSONField()
    author_email = models.CharField(max_length=254, blank=True)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.scenario.slug} @ {self.created_at:%Y-%m-%d %H:%M}"


class ScenarioEmbedding(models.Model):
    """A stored vector for one scenario in one language.

    Vectors are kept as a plain JSON list of floats — the canonical, engine-portable form
    that keeps the SQLite dev/test path working. On PostgreSQL a parallel ``vector_vec``
    pgvector column (added by migration 0003, optional) accelerates retrieval; the JSON
    stays the source of truth (mirrors ``knowledge.KnowledgeChunk``).
    """

    scenario = models.ForeignKey(
        Scenario, related_name="embeddings", on_delete=models.CASCADE
    )
    language = models.CharField(max_length=2)
    vector = models.JSONField(default=list)
    model = models.CharField(max_length=80, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "language"], name="uniq_scenario_language_embedding"
            )
        ]

    def __str__(self):
        return f"{self.scenario.slug} [{self.language}] ({len(self.vector)}d)"
