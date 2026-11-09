from django.urls import path

from .click import ClickCompleteView, ClickPrepareView
from .payme import PaymeView
from .views import CheckoutView, MyBillingView, PlanListView

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="billing-plans"),
    path("me/", MyBillingView.as_view(), name="billing-me"),
    path("checkout/", CheckoutView.as_view(), name="billing-checkout"),
    path("payme/", PaymeView.as_view(), name="billing-payme"),
    path("click/prepare/", ClickPrepareView.as_view(), name="billing-click-prepare"),
    path("click/complete/", ClickCompleteView.as_view(), name="billing-click-complete"),
]
