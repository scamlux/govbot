from django.db.models import Count, Q
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny, IsAdminUser

from .models import Category, Scenario
from .serializers import (
    AdminCategorySerializer,
    AdminScenarioSerializer,
    CategorySerializer,
    ScenarioDetailSerializer,
    ScenarioListSerializer,
)

VALID_LANGS = {"uz", "ru", "en"}


def resolve_lang(request) -> str:
    lang = request.query_params.get("lang", "uz").lower()
    return lang if lang in VALID_LANGS else "uz"


class LangSerializerContextMixin:
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["lang"] = resolve_lang(self.request)
        return ctx


class CategoryListView(LangSerializerContextMixin, generics.ListAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.annotate(
            published_count=Count("scenarios", filter=Q(scenarios__is_published=True))
        ).order_by("order", "slug")


class ScenarioListView(LangSerializerContextMixin, generics.ListAPIView):
    serializer_class = ScenarioListSerializer

    def get_queryset(self):
        qs = Scenario.objects.filter(is_published=True).select_related("category")

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)

        search = self.request.query_params.get("search")
        if search:
            lang = resolve_lang(self.request)
            qs = qs.filter(
                Q(**{f"title__{lang}__icontains": search})
                | Q(**{f"body__{lang}__icontains": search})
                | Q(tags__icontains=search)
            )
        return qs


class ScenarioDetailView(LangSerializerContextMixin, generics.RetrieveAPIView):
    serializer_class = ScenarioDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Scenario.objects.filter(is_published=True).select_related("category")


# ---------------------------------------------------------------------------
# Admin (staff-only) CRUD viewsets.
# ---------------------------------------------------------------------------
class AdminCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminCategorySerializer
    queryset = Category.objects.all().order_by("order", "slug")


class AdminScenarioViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminScenarioSerializer
    queryset = Scenario.objects.select_related("category").order_by("order", "slug")
