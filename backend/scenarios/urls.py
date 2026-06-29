from django.urls import path

from .views import CategoryListView, ScenarioDetailView, ScenarioListView

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("", ScenarioListView.as_view(), name="scenario-list"),
    path("<slug:slug>/", ScenarioDetailView.as_view(), name="scenario-detail"),
]
