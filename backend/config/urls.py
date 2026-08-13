from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import AdminUserDetailView, AdminUserListView
from chat.admin_views import (
    AdminCatalogGapsView,
    AdminConversationDetailView,
    AdminConversationListView,
    AdminFeedbackListView,
    AdminHealthView,
    AdminQuestionAnalyticsView,
    AdminUsageAnalyticsView,
)
from scenarios.views import AdminCategoryViewSet, AdminScenarioViewSet


def health(_request):
    return JsonResponse({"status": "ok", "service": "govbot-backend"})


# Staff-only admin API (DRF router).
admin_router = DefaultRouter()
admin_router.register("categories", AdminCategoryViewSet, basename="admin-category")
admin_router.register("scenarios", AdminScenarioViewSet, basename="admin-scenario")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("api/admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    # Chat oversight (A3 feedback, C1/C2 analytics) — staff only.
    path("api/admin/feedback/", AdminFeedbackListView.as_view(), name="admin-feedback"),
    path(
        "api/admin/analytics/questions/",
        AdminQuestionAnalyticsView.as_view(),
        name="admin-analytics-questions",
    ),
    path(
        "api/admin/analytics/gaps/",
        AdminCatalogGapsView.as_view(),
        name="admin-analytics-gaps",
    ),
    path(
        "api/admin/analytics/usage/",
        AdminUsageAnalyticsView.as_view(),
        name="admin-analytics-usage",
    ),
    path("api/admin/health/", AdminHealthView.as_view(), name="admin-health"),
    path(
        "api/admin/conversations/",
        AdminConversationListView.as_view(),
        name="admin-conversations",
    ),
    path(
        "api/admin/conversations/<int:pk>/",
        AdminConversationDetailView.as_view(),
        name="admin-conversation-detail",
    ),
    path("api/admin/", include(admin_router.urls)),
    path("api/", include("chat.urls")),
    path("api/scenarios/", include("scenarios.urls")),
    path("api/", include("knowledge.urls")),
]
