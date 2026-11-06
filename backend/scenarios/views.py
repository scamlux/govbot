import datetime

from django.conf import settings
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from chat.safety import apostrophe_variants, normalize_apostrophes

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


SEARCH_RESULT_LIMIT = 12
PUBLIC_CACHE_CONTROL = "public, max-age=300"


def add_public_cache(response):
    """Mark a *successful* public catalog response as CDN/browser cacheable (5 min)."""
    if response.status_code == 200:
        response["Cache-Control"] = PUBLIC_CACHE_CONTROL
    return response


def _fold(text) -> str:
    return normalize_apostrophes(str(text or "")).casefold()


def _terms(search: str) -> list[list[str]]:
    """Whitespace-split query -> per term, every folded apostrophe spelling."""
    return [
        [_fold(v) for v in apostrophe_variants(word)]
        for word in search.split()
    ]


def _hit(variants: list[str], haystacks: list[str]) -> bool:
    return any(v in h for v in variants for h in haystacks)


def rank_search(qs, search: str):
    """Language-independent, ranked catalog search (Python-side: the catalog is small).

    * every whitespace-separated term must match (AND), against title / tags / body in
      **all** languages, so "паспорт" finds scenarios while the UI is in Uzbek;
    * rank: all terms in the title (3) > all in title+tags (2) > body-only (1);
    * body-only hits are dropped when any title/tag hit exists;
    * at most ``SEARCH_RESULT_LIMIT`` results, ordered by rank then catalog order.
    Python matching also fixes SQLite's ASCII-only ``icontains`` for Cyrillic and the
    JSON-escaped (``\\uXXXX``) stored tags.
    """
    terms = _terms(search)
    if not terms:
        return qs
    scored = []
    for s in qs:
        title = [_fold(v) for v in (s.title or {}).values()]
        tags = [_fold(t) for t in (s.tags or [])]
        body = [_fold(v) for v in (s.body or {}).values()]
        if not all(_hit(t, title + tags + body) for t in terms):
            continue
        if all(_hit(t, title) for t in terms):
            rank = 3
        elif all(_hit(t, title + tags) for t in terms):
            rank = 2
        else:
            rank = 1
        scored.append((-rank, s.order, s.slug, s.pk))
    scored.sort()
    if any(r <= -2 for r, *_ in scored):
        scored = [row for row in scored if row[0] <= -2]
    pks = [row[3] for row in scored[:SEARCH_RESULT_LIMIT]]
    position = Case(
        *[When(pk=pk, then=Value(i)) for i, pk in enumerate(pks)],
        default=Value(len(pks)),
        output_field=IntegerField(),
    )
    return (
        Scenario.objects.filter(pk__in=pks)
        .select_related("category")
        .annotate(search_position=position)
        .order_by("search_position")
    )


class CategoryListView(LangSerializerContextMixin, generics.ListAPIView):
    serializer_class = CategorySerializer

    def list(self, request, *args, **kwargs):
        return add_public_cache(super().list(request, *args, **kwargs))

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

        # R4 — catalog text mixes ASCII ' and ʻ, and so do users, so the term is
        # expanded to every apostrophe spelling (stored text can't be folded in SQL).
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = rank_search(qs, search)
        return qs

    def list(self, request, *args, **kwargs):
        return add_public_cache(super().list(request, *args, **kwargs))


class ScenarioDetailView(LangSerializerContextMixin, generics.RetrieveAPIView):
    serializer_class = ScenarioDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Scenario.objects.filter(is_published=True).select_related("category")

    def retrieve(self, request, *args, **kwargs):
        return add_public_cache(super().retrieve(request, *args, **kwargs))


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
