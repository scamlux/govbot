"""Default plan rows. Created only when missing — owner edits in Django admin are never overwritten."""
from .models import Plan

DEFAULT_PLANS = [
    {
        "code": "free",
        "name": {"uz": "Bepul", "ru": "Бесплатный", "en": "Free"},
        "daily_question_limit": None,  # nothing enforced until the owner sets a limit
        "features": [],
        "order": 0,
    },
    {
        "code": "plus",
        "name": {"uz": "Plus", "ru": "Plus", "en": "Plus"},
        "daily_question_limit": None,
        "features": ["priority_answers", "history_export"],
        "order": 1,
    },
    {
        "code": "business",
        "name": {"uz": "Business", "ru": "Business", "en": "Business"},
        "daily_question_limit": None,
        "features": ["priority_answers", "history_export", "team_seats"],
        "order": 2,
    },
]


def seed_plans() -> int:
    """Create the missing default plans (price_uzs=None → not for sale). Returns rows created."""
    created = 0
    for spec in DEFAULT_PLANS:
        _, was_created = Plan.objects.get_or_create(
            code=spec["code"], defaults={**spec, "price_uzs": None}
        )
        created += int(was_created)
    return created
