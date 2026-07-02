from django.contrib import admin

from .models import Category, Scenario, ScenarioEmbedding, localize


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["display_name", "slug", "icon", "order"]
    prepopulated_fields = {"slug": ()}
    search_fields = ["slug"]
    ordering = ["order"]

    @admin.display(description="Name")
    def display_name(self, obj):
        return localize(obj.name, "en") or obj.slug


@admin.register(Scenario)
class ScenarioAdmin(admin.ModelAdmin):
    list_display = ["display_title", "slug", "category", "is_published", "order", "updated_at"]
    list_filter = ["category", "is_published"]
    search_fields = ["slug"]
    ordering = ["category", "order"]
    list_editable = ["is_published", "order"]

    @admin.display(description="Title")
    def display_title(self, obj):
        return localize(obj.title, "en") or obj.slug


@admin.register(ScenarioEmbedding)
class ScenarioEmbeddingAdmin(admin.ModelAdmin):
    list_display = ["scenario", "language", "dims", "model", "updated_at"]
    list_filter = ["language", "model"]
    search_fields = ["scenario__slug"]
    readonly_fields = ["scenario", "language", "vector", "model", "updated_at"]

    @admin.display(description="Dims")
    def dims(self, obj):
        return len(obj.vector or [])
