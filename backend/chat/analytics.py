"""Aggregate chat traffic into admin insight (Epic C).

Two reports, both computed with a handful of aggregate queries (no per-row Python loops
over the DB) so they stay cheap as traffic grows:

* ``question_analytics`` (C1) — what citizens ask: top terms, message/conversation counts,
  and a split by language, over a trailing window.
* ``catalog_gaps`` (C2) — frequent questions that retrieved **no** grounding. Each cluster
  is a missing scenario: reuse the persisted ``Message.sources`` (B3) — an assistant reply
  with no sources means its user question wasn't covered by the catalog.

Only aggregates leave this module — never per-user PII beyond the question text itself.
"""
import re
from collections import Counter
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from .models import Conversation, Message

_WORD_RE = re.compile(r"\w+", re.UNICODE)

# Cross-language stopwords: high-frequency function words that would otherwise dominate the
# "top terms" list without signalling a topic. Kept deliberately small.
_STOPWORDS = {
    # en
    "the", "and", "for", "how", "what", "can", "you", "are", "with", "does", "did",
    "have", "has", "was", "were", "this", "that", "your", "get", "from", "about", "need",
    "want", "will", "should", "would", "there", "here", "when", "where", "who", "why",
    "which", "and", "but", "not", "all", "any", "may", "could",
    # ru
    "как", "что", "где", "это", "для", "или", "если", "мне", "нужно", "быть", "можно",
    "какой", "какая", "какие", "когда", "чтобы", "есть", "надо", "мой", "моя", "мои",
    "вы", "ты", "они", "оно", "она", "так", "уже", "еще", "нет", "да",
    # uz
    "uchun", "qanday", "qayerda", "bu", "yoki", "agar", "menga", "kerak", "bo'ladi",
    "qachon", "nima", "men", "siz", "ular", "ham", "va", "yana", "yo'q", "ha",
}
_MIN_TERM_LEN = 3
_TOP_TERMS = 15


def _since(days: int):
    return timezone.now() - timedelta(days=max(1, days))


def _top_terms(contents, limit=_TOP_TERMS):
    counter: Counter = Counter()
    for text in contents:
        for word in _WORD_RE.findall(text or ""):
            w = word.lower()
            if len(w) >= _MIN_TERM_LEN and w not in _STOPWORDS and not w.isdigit():
                counter[w] += 1
    return [{"term": term, "count": count} for term, count in counter.most_common(limit)]


def question_analytics(days: int = 30) -> dict:
    """C1 — top terms, counts, and a language split over the trailing ``days`` window."""
    since = _since(days)
    user_msgs = Message.objects.filter(role=Message.USER, created_at__gte=since)

    contents = list(user_msgs.values_list("content", flat=True))

    by_language = list(
        user_msgs.values("conversation__language")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    language_split = [
        {"language": row["conversation__language"], "count": row["count"]}
        for row in by_language
    ]

    conversation_count = (
        Conversation.objects.filter(messages__created_at__gte=since)
        .distinct()
        .count()
    )

    return {
        "days": days,
        "message_count": len(contents),
        "conversation_count": conversation_count,
        "language_split": language_split,
        "top_terms": _top_terms(contents),
    }


def catalog_gaps(days: int = 30, limit: int = 20) -> dict:
    """C2 — cluster the user questions whose assistant reply retrieved no grounding.

    Ranked by frequency; each cluster is a candidate scenario to author. Clustering is a
    simple normalized-text bucket (lowercased, whitespace-collapsed) — cheap and good
    enough to surface the obviously-missing topics.
    """
    since = _since(days)
    # Assistant replies with no persisted sources = the question was ungrounded (B3).
    ungrounded = (
        Message.objects.filter(
            role=Message.ASSISTANT, created_at__gte=since, sources__isnull=True
        )
        .select_related("conversation")
        .order_by("conversation_id", "created_at")
    )

    # Map each ungrounded assistant reply back to the user question just before it.
    # One extra query for the candidate user messages, then matched in Python.
    conv_ids = {m.conversation_id for m in ungrounded}
    user_msgs = list(
        Message.objects.filter(
            role=Message.USER, conversation_id__in=conv_ids, created_at__gte=since
        ).order_by("conversation_id", "created_at")
    )

    clusters: Counter = Counter()
    examples: dict = {}
    for assistant in ungrounded:
        question = _preceding_question(user_msgs, assistant)
        if not question:
            continue
        key = " ".join(question.lower().split())
        clusters[key] += 1
        examples.setdefault(key, question.strip())

    gaps = [
        {"question": examples[key], "count": count}
        for key, count in clusters.most_common(limit)
    ]
    return {"days": days, "gaps": gaps}


def _preceding_question(user_msgs, assistant) -> str:
    """The latest user message in the same conversation before ``assistant``."""
    best = ""
    for m in user_msgs:
        if m.conversation_id != assistant.conversation_id:
            continue
        if m.created_at <= assistant.created_at:
            best = m.content
        else:
            break
    return best
