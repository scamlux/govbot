"""Aggregate question analytics for the staff dashboard (Backlog C1).

Privacy: everything here is aggregate. We never return raw question text — "topics" are
derived from the grounding sources persisted on assistant replies (B3), i.e. matched
scenario slugs, so no names / passport numbers / addresses can leak into the dashboard.
Ungrounded replies (empty sources) are counted as the catalog-gap signal that C2 builds on.
"""

from collections import Counter
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from .models import Conversation, Message, MessageFeedback

TOP_TOPICS_LIMIT = 10


def question_analytics(days: int = 30) -> dict:
    cutoff = timezone.now() - timedelta(days=days)

    convs = Conversation.objects.filter(created_at__gte=cutoff)
    user_msgs = Message.objects.filter(role=Message.USER, created_at__gte=cutoff)
    assistant_msgs = Message.objects.filter(
        role=Message.ASSISTANT, created_at__gte=cutoff
    )

    # --- Volume + language split (pure GROUP BY aggregation) ---
    conv_by_lang = {
        row["language"]: row["n"]
        for row in convs.values("language").annotate(n=Count("id"))
    }
    q_by_lang = {
        row["conversation__language"]: row["n"]
        for row in user_msgs.values("conversation__language").annotate(n=Count("id"))
    }
    by_language = [
        {
            "language": lang,
            "conversations": conv_by_lang.get(lang, 0),
            "questions": q_by_lang.get(lang, 0),
        }
        for lang in sorted(set(conv_by_lang) | set(q_by_lang))
    ]

    # --- Feedback overview (satisfaction metric) ---
    fb = MessageFeedback.objects.filter(created_at__gte=cutoff)
    up = fb.filter(rating=MessageFeedback.UP).count()
    down = fb.filter(rating=MessageFeedback.DOWN).count()
    total_fb = up + down
    satisfaction = round(up / total_fb, 3) if total_fb else None

    # --- Grounding + top topics (from persisted sources, not raw text) ---
    grounded = ungrounded = 0
    topics: Counter = Counter()
    # Pull only the sources column, not the (potentially large) answer bodies.
    for src in assistant_msgs.values_list("sources", flat=True):
        if src:
            grounded += 1
            for item in src:
                slug = item.get("slug")
                if slug:
                    topics[(slug, item.get("title", ""))] += 1
        else:
            ungrounded += 1
    total_answers = grounded + ungrounded
    grounding_rate = round(grounded / total_answers, 3) if total_answers else None

    top_topics = [
        {"slug": slug, "title": title, "count": n}
        for (slug, title), n in topics.most_common(TOP_TOPICS_LIMIT)
    ]

    return {
        "days": days,
        "totals": {
            "conversations": convs.count(),
            "questions": user_msgs.count(),
            "answers": total_answers,
        },
        "by_language": by_language,
        "feedback": {
            "up": up,
            "down": down,
            "total": total_fb,
            "satisfaction": satisfaction,
        },
        "grounding": {
            "grounded": grounded,
            "ungrounded": ungrounded,
            "rate": grounding_rate,
        },
        "top_topics": top_topics,
    }
