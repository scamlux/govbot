from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import checkout, config
from .limits import check_question_allowed, questions_used_today
from .models import Order, Plan
from .services import active_subscription_for

LANGS = ("uz", "ru", "en")


def _lang(request) -> str:
    lang = request.query_params.get("lang")
    return lang if lang in LANGS else "uz"


def plan_payload(plan: Plan, lang: str) -> dict:
    return {
        "code": plan.code,
        "name": plan.localized_name(lang),
        "price_uzs": plan.price_uzs,
        "for_sale": plan.for_sale,
        "period_days": plan.period_days,
        "daily_question_limit": plan.daily_question_limit,
        "features": plan.features or [],
    }


class PlanListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        lang = _lang(request)
        plans = Plan.objects.filter(is_active=True)
        return Response({"plans": [plan_payload(p, lang) for p in plans]})


class MyBillingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = _lang(request)
        decision = check_question_allowed(request.user)
        sub = active_subscription_for(request.user)
        plan = sub.plan if sub else Plan.objects.filter(code="free").first()
        return Response({
            "plan": plan_payload(plan, lang) if plan else None,
            "used_today": questions_used_today(request.user),
            "limit": decision.limit,
            "unlimited": decision.limit is None or request.user.is_staff,
            "subscription_end": sub.current_period_end if sub else None,
        })


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        provider, code = data.get("provider"), data.get("plan")
        providers = config.checkout_providers()
        if not config.billing_enabled():
            return _bad("billing_disabled", "Billing is not enabled.")
        if provider not in providers:
            return _bad("provider_unavailable", "Payment provider is not configured.")
        plan = Plan.objects.filter(code=code, is_active=True).first() if isinstance(code, str) else None
        if not plan or not plan.for_sale:
            return _bad("plan_not_for_sale", "This plan is not available for purchase.")
        with transaction.atomic():
            order = Order.objects.create(
                user=request.user, plan=plan, amount_tiyin=plan.price_tiyin
            )
        lang = data.get("lang") if data.get("lang") in LANGS else request.user.preferred_language
        url = checkout.payme_url(order, lang) if provider == "payme" else checkout.click_url(order)
        return Response({"order_id": order.pk, "provider": provider, "url": url},
                        status=status.HTTP_201_CREATED)


def _bad(code: str, detail: str) -> Response:
    return Response({"code": code, "detail": detail}, status=status.HTTP_400_BAD_REQUEST)
