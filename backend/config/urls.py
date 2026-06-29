from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import AdminUserListView
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
    path("api/admin/", include(admin_router.urls)),
    path("api/", include("chat.urls")),
    path("api/scenarios/", include("scenarios.urls")),
]
