"""Retrieval-augmented grounding for the chat assistant.

Turns the Scenario Catalog into a fact source for the LLM. For a user query we find the
most relevant published scenarios and hand their text to the model as reference material,
so answers about Uzbek public services are grounded in curated content instead of the
model's parametric memory (which is exactly where hallucinated fees / deadlines / article
numbers come from).

Two retrieval modes, chosen automatically:

* **vector**  — when an OpenAI key is configured we embed the query and rank stored
  ``ScenarioEmbedding`` vectors by cosine similarity, brute-force in Python. At catalog
  scale this is effectively free and needs no pgvector / external index.
* **keyword** — fallback used in mock mode (no key) or before embeddings are built:
  case-insensitive term overlap against the scenario text in the requested language. This
  keeps grounding demonstrable in local development without a key or network access.
"""
import logging
import math
import re

from django.conf import settings

logger = logging.getLogger(__name__)

# Tunables (overridable via env / settings — B4).
EMBEDDING_MODEL = getattr(settings, "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
TOP_K = getattr(settings, "RETRIEVAL_TOP_K", 3)
# cosine floor: below this a scenario is treated as irrelevant.
MIN_SCORE = getattr(settings, "RETRIEVAL_MIN_SCORE", 0.28)
_WORD_RE = re.compile(r"\w+", re.UNICODE)


def embeddings_enabled() -> bool:
    """Vector mode is only possible when an OpenAI key is present."""
    return bool(settings.OPENAI_API_KEY)


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------
def embed_text(text: str) -> list[float] | None:
    """Return an embedding vector for ``text`` (or ``None`` in mock mode / on failure)."""
    text = (text or "").strip()
    if not text or not embeddings_enabled():
        return None
    vectors = embed_texts([text])
    return vectors[0] if vectors else None


def embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Embed several texts in a single request (order preserved).

    Returns ``None`` in mock mode / on failure. Batching lets callers (e.g. embedding all
    three languages of a scenario) pay one round-trip instead of one per text.
    """
    texts = [t for t in (texts or []) if t and t.strip()]
    if not texts or not embeddings_enabled():
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
        return [item.embedding for item in resp.data]
    except Exception:  # noqa: BLE001 — degrade to keyword mode instead of failing the chat
        logger.exception("Embedding request failed; falling back to keyword retrieval")
        return None


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# Generic interrogatives / filler words dropped in keyword mode so a shared "how"/"what"
# (very common in scenario titles like "How to renew…") can't alone qualify a match.
_KEYWORD_STOP = {
    "the", "how", "what", "where", "when", "which", "who", "why", "does", "did", "for",
    "and", "you", "your", "with", "can", "need", "want", "get", "from", "about",
    "как", "что", "где", "когда", "какой", "для", "или", "нужно", "можно",
    "qanday", "qayerda", "qachon", "nima", "uchun", "kerak",
}


def _tokens(text: str) -> set[str]:
    return {
        w.lower()
        for w in _WORD_RE.findall(text or "")
        if len(w) > 2 and w.lower() not in _KEYWORD_STOP
    }


def _vector_retrieve(query_vec, language, k):
    """Rank stored embeddings for ``language`` by cosine similarity to the query."""
    from scenarios.models import ScenarioEmbedding

    rows = ScenarioEmbedding.objects.filter(
        language=language, scenario__is_published=True
    ).select_related("scenario")

    scored = []
    for row in rows:
        score = cosine(query_vec, row.vector)
        if score >= MIN_SCORE:
            scored.append((row.scenario, score))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:k]


def _keyword_retrieve(query, language, k):
    """Fallback: rank published scenarios by distinct query-term overlap in ``language``."""
    from scenarios.models import Scenario

    q_tokens = _tokens(query)
    if not q_tokens:
        return []

    scored = []
    for scenario in Scenario.objects.filter(is_published=True):
        text = scenario.embedding_source_text(language)
        overlap = len(q_tokens & _tokens(text))
        if overlap:
            scored.append((scenario, float(overlap)))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:k]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def retrieve(query: str, language: str, k: int = TOP_K) -> list[dict]:
    """Return up to ``k`` grounding snippets for ``query`` in ``language``.

    Each snippet: ``{slug, title, text, source_url, score, mode}``. Empty list means
    nothing relevant was found — the caller should then answer without grounding.
    """
    from scenarios.models import localize

    query = (query or "").strip()
    if not query:
        return []

    query_vec = embed_text(query)
    if query_vec is not None:
        pairs, mode = _vector_retrieve(query_vec, language, k), "vector"
        if not pairs:  # embeddings exist but nothing cleared the floor — try keywords
            pairs, mode = _keyword_retrieve(query, language, k), "keyword"
    else:
        pairs, mode = _keyword_retrieve(query, language, k), "keyword"

    snippets = []
    for scenario, score in pairs:
        snippets.append(
            {
                "slug": scenario.slug,
                "title": localize(scenario.title, language),
                "text": localize(scenario.body, language),
                "source_url": scenario.source_url,
                "score": round(float(score), 4),
                "mode": mode,
            }
        )
    return snippets
