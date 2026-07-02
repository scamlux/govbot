"""Staff-only admin API for chat oversight (A3 feedback list, C1/C2 analytics)."""
from rest_framework import generics, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import analytics
from .models import MessageFeedback


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
