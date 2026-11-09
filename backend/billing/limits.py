"""Daily question limits (one function used by every authenticated chat endpoint)."""
from dataclasses import dataclass

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .services import active_plan_for

PLAN_LIMIT_MESSAGE = {
    "uz": "Bugungi savollar limiti tugadi ({limit} ta). Ertaga qayta urinib ko'ring yoki tarifni yangilang.",
    "ru": "Дневной лимит вопросов исчерпан ({limit}). Попробуйте завтра или обновите тариф.",
    "en": "Daily question limit reached ({limit}). Try again tomorrow or upgrade your plan.",
}


@dataclass(frozen=True)
class LimitDecision:
    allowed: bool
    plan_code: str | None
    limit: int | None
    used: int


def local_midnight():
    """Start of the current day in settings.TIME_ZONE (Asia/Tashkent), as an aware datetime."""
    return timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)


def questions_used_today(user) -> int:
    from chat.models import Message

    return Message.objects.filter(
        conversation__user=user, role=Message.USER, created_at__gte=local_midnight()
    ).count()


def check_question_allowed(user) -> LimitDecision:
    plan = active_plan_for(user)
    limit = plan.daily_question_limit if plan else None
    code = plan.code if plan else None
    if getattr(user, "is_staff", False) or limit is None:
        return LimitDecision(True, code, limit, 0)
    used = questions_used_today(user)
    return LimitDecision(used < limit, code, limit, used)


def limit_response(decision: LimitDecision, language: str | None) -> Response:
    lang = language if language in PLAN_LIMIT_MESSAGE else "uz"
    return Response(
        {
            "code": "plan_limit",
            "detail": PLAN_LIMIT_MESSAGE[lang].format(limit=decision.limit),
            "plan": decision.plan_code,
            "limit": decision.limit,
        },
        status=status.HTTP_402_PAYMENT_REQUIRED,
    )
