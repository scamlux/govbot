import datetime

from django.conf import settings
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from chat.safety import normalize_apostrophes

from .models import Category, Scenario, ScenarioRevision
from .serializers import (
    AdminCategorySerializer,
    AdminScenarioSerializer,
    CategorySerializer,
    ScenarioDetailSerializer,
    ScenarioListSerializer,
    ScenarioRevisionSerializer,
    is_stale,
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

        # B3 — role filter. Scenarios with no audience apply to everyone, so they stay.
        audience = self.request.query_params.get("audience")
        if audience in Scenario.AUDIENCES:
            qs = [s for s in qs if not s.audience or audience in s.audience]
            qs = Scenario.objects.filter(pk__in=[s.pk for s in qs]).select_related("category")

        # R4 — fold ʻ ʼ ‘ ’ ` to ASCII ' so phone-keyboard Uzbek matches the catalog text.
        search = normalize_apostrophes(self.request.query_params.get("search") or "").strip()
        if search:
            lang = resolve_lang(self.request)
            title_match = Q(**{f"title__{lang}__icontains": search})
            tags_match = Q(tags__icontains=search)
            body_match = Q(**{f"body__{lang}__icontains": search})
            # Rank by where the term hit: a title match is far more relevant than
            # a passing mention in the body (e.g. "паспорт" as a required
            # document inside the driving-licence scenario). Title > tags > body,
            # then the catalog's own order. Without this, results came back in
            # plain catalog order and body-only matches outranked title matches.
            qs = (
                qs.filter(title_match | body_match | tags_match)
                .annotate(
                    search_rank=Case(
                        When(title_match, then=Value(3)),
                        When(tags_match, then=Value(2)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                )
                .order_by("-search_rank", "order", "slug")
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

    def get_queryset(self):
        qs = (
            Scenario.objects.select_related("category")
            .annotate(revision_count=Count("revisions"))
            .order_by("order", "slug")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    # ---- E2 — revision history + rollback ----
    @action(detail=True, methods=["get"])
    def revisions(self, request, pk=None):
        scenario = self.get_object()
        data = ScenarioRevisionSerializer(scenario.revisions.all()[:50], many=True).data
        return Response(data)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"revisions/(?P<revision_id>\d+)/restore",
    )
    def restore(self, request, pk=None, revision_id=None):
        scenario = self.get_object()
        revision = get_object_or_404(ScenarioRevision, pk=revision_id, scenario=scenario)
        # The restore itself is undoable: snapshot the current state first.
        ScenarioRevision.objects.create(
            scenario=scenario,
            data=scenario.snapshot(),
            author_email=request.user.email,
            note=f"before restore of revision {revision.id}",
        )
        data = revision.data
        for field in ("title", "body", "source_url", "tags", "checklist", "audience"):
            if field in data:
                setattr(scenario, field, data[field])
        if data.get("category_id") and Category.objects.filter(pk=data["category_id"]).exists():
            scenario.category_id = data["category_id"]
        scenario.verified_at = (
            datetime.date.fromisoformat(data["verified_at"]) if data.get("verified_at") else None
        )
        scenario.set_status(data.get("status") or Scenario.STATUS_DRAFT)
        scenario.save()
        return Response(self.get_serializer(scenario).data)

    # ---- E4 — stale content report ----
    @action(detail=False, methods=["get"])
    def stale(self, request):
        published = self.get_queryset().filter(is_published=True)
        stale = [s for s in published if is_stale(s)]
        return Response(
            {
                "stale_days": getattr(settings, "SCENARIO_STALE_DAYS", 90),
                "count": len(stale),
                "scenarios": AdminScenarioSerializer(stale, many=True).data,
            }
        )
