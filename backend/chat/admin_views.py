"""Staff-only admin API for chat oversight (A3 feedback list, C1/C2/C3 analytics,
conversation viewer, system health)."""
from django.conf import settings
from django.db import connection
from django.db.models import Count
from rest_framework import generics, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import analytics
from .models import Conversation, Message, MessageFeedback


class AdminFeedbackSerializer(serializers.ModelSerializer):
    """A3 — a rating plus enough context to locate and judge the answer."""

    message_id = serializers.IntegerField(source="message.id", read_only=True)
    message_content = serializers.CharField(source="message.content", read_only=True)
    conversation_id = serializers.IntegerField(
        source="message.conversation_id", read_only=True
    )
    conversation_language = serializers.CharField(
        source="message.conversation.language", read_only=True
    )

    class Meta:
        model = MessageFeedback
        fields = [
            "id",
            "rating",
            "reason",
            "created_at",
            "message_id",
            "message_content",
            "conversation_id",
            "conversation_language",
        ]
        read_only_fields = fields


class FeedbackPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminFeedbackListView(generics.ListAPIView):
    """A3 — GET /api/admin/feedback/?rating=down — newest first, paginated, staff only."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminFeedbackSerializer
    pagination_class = FeedbackPagination

    def get_queryset(self):
        qs = MessageFeedback.objects.select_related(
            "message", "message__conversation"
        ).order_by("-created_at")
        rating = self.request.query_params.get("rating")
        if rating in (MessageFeedback.UP, MessageFeedback.DOWN):
            qs = qs.filter(rating=rating)
        return qs


def _days_param(request, default=30, cap=365) -> int:
    try:
        days = int(request.query_params.get("days", default))
    except (TypeError, ValueError):
        return default
    return max(1, min(days, cap))


class AdminQuestionAnalyticsView(APIView):
    """C1 — GET /api/admin/analytics/questions/?days=30 (staff only)."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(analytics.question_analytics(_days_param(request)))


class AdminCatalogGapsView(APIView):
    """C2 — GET /api/admin/analytics/gaps/?days=30 (staff only)."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(analytics.catalog_gaps(_days_param(request)))


# ---- Conversation viewer (C3 monitoring) ----
class AdminConversationSerializer(serializers.ModelSerializer):
    """List row: who, what, how big — no message bodies (kept for the detail view)."""

    user_email = serializers.EmailField(source="user.email", read_only=True)
    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "user_email", "title", "language", "message_count",
                  "created_at", "updated_at"]
        read_only_fields = fields


class AdminMessageSerializer(serializers.ModelSerializer):
    feedback = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "role", "content", "tokens", "model", "sources",
                  "created_at", "feedback"]
        read_only_fields = fields

    def get_feedback(self, obj):
        fb = getattr(obj, "feedback", None)
        if fb is None:
            return None
        return {"rating": fb.rating, "reason": fb.reason}


class AdminConversationDetailSerializer(AdminConversationSerializer):
    messages = AdminMessageSerializer(many=True, read_only=True)

    class Meta(AdminConversationSerializer.Meta):
        fields = AdminConversationSerializer.Meta.fields + ["messages"]
        read_only_fields = fields


class AdminConversationListView(generics.ListAPIView):
    """GET /api/admin/conversations/ — every user's conversations, newest first."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminConversationSerializer
    pagination_class = FeedbackPagination

    def get_queryset(self):
        return (
            Conversation.objects.select_related("user")
            .annotate(message_count=Count("messages"))
            .order_by("-updated_at")
        )


class AdminConversationDetailView(generics.RetrieveDestroyAPIView):
    """GET/DELETE /api/admin/conversations/{id}/ — view or remove a thread (moderation)."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminConversationDetailSerializer

    def get_queryset(self):
        return (
            Conversation.objects.select_related("user")
            .annotate(message_count=Count("messages"))
            .prefetch_related("messages", "messages__feedback")
        )


# ---- Usage analytics (C3) ----
class AdminUsageAnalyticsView(APIView):
    """GET /api/admin/analytics/usage/?days=30 — per-day volume, language split, totals."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(analytics.usage_analytics(_days_param(request)))


# ---- System health (C3) ----
class AdminHealthView(APIView):
    """GET /api/admin/health/ — at-a-glance operational status for the operator."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        # DB connectivity.
        db_ok = True
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        except Exception:  # noqa: BLE001 — health check reports, never raises
            db_ok = False

        # Embedding coverage: rows present vs published scenarios x 3 languages expected.
        from scenarios.models import Scenario, ScenarioEmbedding

        published = Scenario.objects.filter(is_published=True).count()
        embeddings = ScenarioEmbedding.objects.count()
        expected = published * 3

        openai_live = bool(getattr(settings, "OPENAI_API_KEY", "") or "")
        rates = (getattr(settings, "REST_FRAMEWORK", {}) or {}).get("DEFAULT_THROTTLE_RATES", {})

        return Response({
            "database": {"ok": db_ok},
            "openai": {"mode": "live" if openai_live else "mock"},
            "embeddings": {"present": embeddings, "expected": expected},
            "throttles": {
                "burst": rates.get("chat_burst"),
                "sustained": rates.get("chat_sustained"),
                "max_message_chars": getattr(settings, "CHAT_MAX_MESSAGE_CHARS", None),
            },
            "counts": {
                "users": _user_count(),
                "conversations": Conversation.objects.count(),
                "messages": Message.objects.count(),
                "scenarios_published": published,
            },
        })


def _user_count():
    from django.contrib.auth import get_user_model
    return get_user_model().objects.count()
