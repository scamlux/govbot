import re

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import LANGUAGE_CODES, Category, Scenario, ScenarioRevision, localize


EXCERPT_LENGTH = 160
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$")
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_EMPHASIS_RE = re.compile(r"(\*{1,3}|_{2,3}|~~|`)")
_LIST_MARKER_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")


def _plain(line: str) -> str:
    """One markdown line -> plain text (no heading/list markers, emphasis, link targets)."""
    line = _HEADING_RE.sub(r"\1", line)
    line = _LIST_MARKER_RE.sub("", line)
    line = _LINK_RE.sub(r"\1", line)
    return " ".join(_EMPHASIS_RE.sub("", line).split())


def make_excerpt(body: str, title: str = "") -> str:
    """List-card preview: markdown stripped, a leading line equal to the title dropped."""
    lines = [ln for ln in (body or "").splitlines() if ln.strip()]
    plain = [_plain(ln) for ln in lines]
    plain = [ln for ln in plain if ln]
    if plain and title and plain[0].casefold() == " ".join(title.split()).casefold():
        plain = plain[1:]
    text = " ".join(plain)
    return (text[:EXCERPT_LENGTH] + "…") if len(text) > EXCERPT_LENGTH else text


def strip_leading_title_heading(body: str, title: str) -> str:
    """Remove the first line when it is a markdown heading equal to the scenario title."""
    if not body or not title:
        return body
    lines = body.split("\n")
    first = next((i for i, ln in enumerate(lines) if ln.strip()), None)
    if first is None:
        return body
    match = _HEADING_RE.match(lines[first])
    if not match or _plain(match.group(1)).casefold() != " ".join(title.split()).casefold():
        return body
    return "\n".join(lines[first + 1:]).lstrip("\n")


class TranslationsField(serializers.JSONField):
    """A {uz,ru,en} dict; coerces missing keys to empty strings."""

    def to_internal_value(self, data):
        data = super().to_internal_value(data)
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected an object keyed by language code.")
        return {code: str(data.get(code, "") or "") for code in LANGUAGE_CODES}


class LangContextMixin:
    """Pulls the requested language from serializer context (?lang=) with a default."""

    def lang(self):
        return self.context.get("lang", "uz")


class CategorySerializer(LangContextMixin, serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    scenario_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["slug", "icon", "name", "description", "order", "scenario_count"]

    def get_name(self, obj):
        return localize(obj.name, self.lang())

    def get_description(self, obj):
        return localize(obj.description, self.lang())

    def get_scenario_count(self, obj):
        # Uses the annotated value when present to avoid N+1 counting.
        return getattr(obj, "published_count", obj.scenarios.filter(is_published=True).count())


class ScenarioListSerializer(LangContextMixin, serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    excerpt = serializers.SerializerMethodField()

    class Meta:
        model = Scenario
        fields = [
            "slug", "title", "excerpt", "category", "tags", "order", "updated_at",
            "verified_at", "source_url", "audience",
        ]

    def get_title(self, obj):
        return localize(obj.title, self.lang())

    def get_excerpt(self, obj):
        return make_excerpt(
            localize(obj.body, self.lang()), localize(obj.title, self.lang())
        )


class ScenarioDetailSerializer(LangContextMixin, serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    checklist = serializers.SerializerMethodField()

    class Meta:
        model = Scenario
        fields = [
            "slug", "title", "body", "source_url", "category", "tags", "updated_at",
            "verified_at", "checklist", "audience",
        ]

    def get_title(self, obj):
        return localize(obj.title, self.lang())

    def get_body(self, obj):
        # The page already renders the title as its H1, so drop a duplicate leading heading.
        return strip_leading_title_heading(
            localize(obj.body, self.lang()), localize(obj.title, self.lang())
        )

    def get_checklist(self, obj):
        return obj.checklist_for(self.lang())


# ---------------------------------------------------------------------------
# Admin (staff) serializers — full multilingual payloads, read + write.
# ---------------------------------------------------------------------------
class AdminCategorySerializer(serializers.ModelSerializer):
    name = TranslationsField()
    description = TranslationsField(required=False)
    order = serializers.IntegerField(required=False)
    scenario_count = serializers.IntegerField(source="scenarios.count", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "slug", "icon", "name", "description", "order", "scenario_count"]

    def create(self, validated_data):
        # Auto-assign the next order when not provided (avoids manual-entry errors).
        if not validated_data.get("order"):
            last = Category.objects.order_by("-order").values_list("order", flat=True).first()
            validated_data["order"] = (last or 0) + 1
        return super().create(validated_data)


class AdminScenarioSerializer(serializers.ModelSerializer):
    title = TranslationsField()
    body = TranslationsField()
    tags = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    order = serializers.IntegerField(required=False)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    status = serializers.ChoiceField(choices=Scenario.STATUSES, required=False)
    verified_at = serializers.DateField(required=False, allow_null=True)
    checklist = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField(allow_blank=False)),
        required=False,
    )
    audience = serializers.ListField(
        child=serializers.ChoiceField(choices=Scenario.AUDIENCES), required=False
    )
    is_stale = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()

    class Meta:
        model = Scenario
        fields = [
            "id",
            "category",
            "category_slug",
            "slug",
            "title",
            "body",
            "source_url",
            "tags",
            "order",
            "is_published",
            "status",
            "verified_at",
            "checklist",
            "audience",
            "is_stale",
            "revision_count",
            "updated_at",
        ]

    def validate_checklist(self, value):
        unknown = set(value) - set(LANGUAGE_CODES)
        if unknown:
            raise serializers.ValidationError(f"Unknown language(s): {', '.join(sorted(unknown))}")
        return {code: [i.strip() for i in value.get(code, []) if i.strip()] for code in LANGUAGE_CODES}

    def get_is_stale(self, obj):
        return is_stale(obj)

    def get_revision_count(self, obj):
        count = getattr(obj, "revision_count", None)
        return count if count is not None else obj.revisions.count()

    def _apply_status(self, instance, validated_data):
        status = validated_data.pop("status", None)
        if status is not None:
            validated_data.pop("is_published", None)
            instance.set_status(status)

    def create(self, validated_data):
        # Auto-assign the next order within the chosen category when not provided.
        if not validated_data.get("order"):
            last = (
                Scenario.objects.filter(category=validated_data["category"])
                .order_by("-order")
                .values_list("order", flat=True)
                .first()
            )
            validated_data["order"] = (last or 0) + 1
        status = validated_data.pop("status", None)
        instance = Scenario(**validated_data)
        if status is not None:
            instance.set_status(status)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        # E2 — snapshot the current content before overwriting it.
        request = self.context.get("request")
        ScenarioRevision.objects.create(
            scenario=instance,
            data=instance.snapshot(),
            author_email=getattr(getattr(request, "user", None), "email", "") or "",
        )
        self._apply_status(instance, validated_data)
        return super().update(instance, validated_data)


def is_stale(scenario) -> bool:
    """E4 — never verified, or verified longer ago than ``SCENARIO_STALE_DAYS``."""
    if not scenario.verified_at:
        return True
    days = getattr(settings, "SCENARIO_STALE_DAYS", 90)
    return (timezone.now().date() - scenario.verified_at).days > days


class ScenarioRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScenarioRevision
        fields = ["id", "data", "author_email", "note", "created_at"]
        read_only_fields = fields
