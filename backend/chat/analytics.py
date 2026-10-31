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
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import Conversation, Message

_WORD_RE = re.compile(r"\w+", re.UNICODE)
_TERM_RE = re.compile(r"\w+(?:'\w+)*", re.UNICODE)

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
    from .safety import normalize_apostrophes

    counter: Counter = Counter()
    for text in contents:
        # Fold ʻ/’ to ' and keep it word-internal, so toʻlov / to'lov / to’lov are one
        # term instead of "toʻlov" + a stray "lov".
        for word in _TERM_RE.findall(normalize_apostrophes(text)):
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


def _non_answer_texts() -> set[str]:
    """Assistant contents that are NOT real answers (OpenAI error + demo/mock replies).

    These persist with ``sources=None`` too, so without excluding them an OpenAI outage
    would flood the gaps report with questions that were actually answered-but-errored.
    """
    from . import services

    return set(services.FRIENDLY_ERROR.values()) | set(services.MOCK_REPLY.values())


def catalog_gaps(days: int = 30, limit: int = 20) -> dict:
    """C2 — cluster the user questions whose assistant reply retrieved no grounding.

    Ranked by frequency; each cluster is a candidate scenario to author. Clustering is a
    simple normalized-text bucket (lowercased, whitespace-collapsed) — cheap and good
    enough to surface the obviously-missing topics. Error/demo replies are excluded so only
    genuine answered-but-ungrounded questions count as gaps.
    """
    since = _since(days)
    # Assistant replies with no persisted sources = the question was ungrounded (B3),
    # excluding canned error/demo replies which also carry sources=None.
    ungrounded = list(
        Message.objects.filter(
            role=Message.ASSISTANT, created_at__gte=since, sources__isnull=True
        )
        .exclude(content__in=_non_answer_texts())
        .order_by("conversation_id", "created_at")
    )

    # Pre-group candidate user messages by conversation once, so mapping each assistant
    # reply to its preceding question is O(total messages), not O(assistants x messages).
    conv_ids = {m.conversation_id for m in ungrounded}
    user_by_conv: dict[int, list] = {}
    for m in Message.objects.filter(
        role=Message.USER, conversation_id__in=conv_ids, created_at__gte=since
    ).order_by("conversation_id", "created_at"):
        user_by_conv.setdefault(m.conversation_id, []).append(m)

    questions: list[str] = []
    for assistant in ungrounded:
        question = _preceding_question(user_by_conv.get(assistant.conversation_id), assistant)
        if question and question.strip():
            questions.append(question.strip())

    groups = cluster_questions(questions)
    gaps = [
        {"question": g["example"], "count": g["count"], "variants": g["variants"][:5]}
        for g in groups[:limit]
    ]
    return {"days": days, "gaps": gaps}


# ---------------------------------------------------------------------------
# A8 — group paraphrases of the same missing topic
# ---------------------------------------------------------------------------
_CLUSTER_STOP = _STOPWORDS | {
    "qanday", "nima", "uchun", "kerak", "qayerda", "qachon", "mumkin", "how", "do", "i",
    "my", "a", "to", "is", "in", "of", "on", "я", "в", "на", "и", "с", "по", "у",
}
_JACCARD_THRESHOLD = 0.5
_COSINE_THRESHOLD = 0.82


def _terms(text: str) -> frozenset:
    from .safety import normalize_apostrophes

    words = _WORD_RE.findall(normalize_apostrophes(text).lower())
    # Crude stemming: the first 5 letters merge "passport"/"passports"/"паспорта".
    return frozenset(w[:5] for w in words if len(w) > 2 and w not in _CLUSTER_STOP)


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def cluster_questions(questions: list[str]) -> list[dict]:
    """Greedy single-pass clustering of near-duplicate questions.

    Vector mode (OpenAI key set): cosine similarity of question embeddings — groups
    paraphrases across wording and even language. Fallback: Jaccard overlap of stemmed
    content terms — still merges "passport renewal" / "renew my passport". Returns groups
    sorted by size: ``[{"example", "count", "variants"}]``.
    """
    from . import retrieval

    if not questions:
        return []

    # Exact (normalised) duplicates first, so the expensive comparison runs on unique text.
    exact: Counter = Counter()
    example_of: dict[str, str] = {}
    for q in questions:
        key = " ".join(q.lower().split())
        exact[key] += 1
        example_of.setdefault(key, q)
    keys = [k for k, _ in exact.most_common()]

    vectors = retrieval.embed_texts(keys) if retrieval.embeddings_enabled() else None

    groups: list[dict] = []
    for idx, key in enumerate(keys):
        terms = _terms(key)
        vec = vectors[idx] if vectors else None
        target = None
        for group in groups:
            if vec is not None and group["vec"] is not None:
                if retrieval.cosine(vec, group["vec"]) >= _COSINE_THRESHOLD:
                    target = group
                    break
            elif _jaccard(terms, group["terms"]) >= _JACCARD_THRESHOLD:
                target = group
                break
        if target is None:
            groups.append(
                {
                    "example": example_of[key],
                    "count": exact[key],
                    "variants": [example_of[key]],
                    "terms": terms,
                    "vec": vec,
                }
            )
        else:
            target["count"] += exact[key]
            target["variants"].append(example_of[key])
            target["terms"] = target["terms"] | terms

    groups.sort(key=lambda g: g["count"], reverse=True)
    return [
        {"example": g["example"], "count": g["count"], "variants": g["variants"]}
        for g in groups
    ]


def _preceding_question(conv_user_msgs, assistant) -> str:
    """The latest user message in the assistant's conversation sent at/before it."""
    best = ""
    for m in conv_user_msgs or []:
        if m.created_at <= assistant.created_at:
            best = m.content
        else:
            break
    return best


def usage_analytics(days: int = 30) -> dict:
    """C3 — usage over the trailing window: per-day volume, language split, totals.

    All aggregates (no per-row Python). Days are zero-filled so the client can
    chart a continuous series.
    """
    since = _since(days)
    start_day = since.date()
    today = timezone.now().date()

    # Per-day message volume + distinct active users.
    msg_rows = (
        Message.objects.filter(created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(messages=Count("id"), active_users=Count("conversation__user", distinct=True))
    )
    # Per-day new conversations.
    conv_rows = (
        Conversation.objects.filter(created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(conversations=Count("id"))
    )

    by_day: dict = {}
    cursor = start_day
    while cursor <= today:
        by_day[cursor] = {
            "date": cursor.isoformat(),
            "messages": 0,
            "conversations": 0,
            "active_users": 0,
        }
        cursor += timedelta(days=1)
    for r in msg_rows:
        d = by_day.get(r["day"])
        if d is not None:
            d["messages"] = r["messages"]
            d["active_users"] = r["active_users"]
    for r in conv_rows:
        d = by_day.get(r["day"])
        if d is not None:
            d["conversations"] = r["conversations"]

    by_language = [
        {"language": row["conversation__language"], "messages": row["messages"]}
        for row in (
            Message.objects.filter(created_at__gte=since)
            .values("conversation__language")
            .annotate(messages=Count("id"))
            .order_by("-messages")
        )
    ]

    return {
        "days": days,
        "series": [by_day[k] for k in sorted(by_day)],
        "by_language": by_language,
        "totals": {
            "messages": Message.objects.filter(created_at__gte=since).count(),
            "conversations": Conversation.objects.filter(created_at__gte=since).count(),
            "active_users": Message.objects.filter(created_at__gte=since)
            .values("conversation__user")
            .distinct()
            .count(),
        },
    }
