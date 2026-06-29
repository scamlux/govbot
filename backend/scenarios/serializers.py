from rest_framework import serializers

from .models import LANGUAGE_CODES, Category, Scenario, localize


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
        fields = ["slug", "title", "excerpt", "category", "tags", "order", "updated_at"]

    def get_title(self, obj):
        return localize(obj.title, self.lang())

    def get_excerpt(self, obj):
        body = localize(obj.body, self.lang())
        text = " ".join(body.split())
        return (text[:160] + "…") if len(text) > 160 else text


class ScenarioDetailSerializer(LangContextMixin, serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Scenario
        fields = ["slug", "title", "body", "category", "tags", "updated_at"]

    def get_title(self, obj):
        return localize(obj.title, self.lang())

    def get_body(self, obj):
        return localize(obj.body, self.lang())


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

    class Meta:
        model = Scenario
        fields = [
            "id",
            "category",
            "category_slug",
            "slug",
            "title",
            "body",
            "tags",
            "order",
            "is_published",
            "updated_at",
        ]

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
        return super().create(validated_data)
