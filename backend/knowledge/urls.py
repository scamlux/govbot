from django.urls import path

from .views import KBTickView

urlpatterns = [
    path("internal/kb/tick/", KBTickView.as_view(), name="kb-tick"),
]
