"""Retrieval-augmented grounding for the chat assistant.

Turns the Scenario Catalog into a fact source for the LLM. For a user query we find the
most relevant published scenarios and hand their text to the model as reference material,
so answers about Uzbek public services are grounded in curated content instead of the
model's parametric memory (which is exactly where hallucinated fees / deadlines / article
numbers come from).

Two retrieval modes, chosen automatically:

* **vector**  — when an OpenAI key is configured we embed the query and rank stored
  ``ScenarioEmbedding`` vectors by cosine similarity. On PostgreSQL with pgvector the
  ranking is an ANN index scan over the mirrored ``vector_vec`` column; everywhere else
  it is brute-force cosine over the canonical JSON vectors, which at catalog scale is
  effectively free.
* **keyword** — fallback used in mock mode (no key) or before embeddings are built:
  case-insensitive term overlap against the scenario text in the requested language. This
  keeps grounding demonstrable in local development without a key or network access.
"""
import logging
import math
import re

from django.conf import settings

logger = logging.getLogger(__name__)

# Tunables (overridable via env / settings — B4). Read at *call time* through the helpers
# below so that ``RETRIEVAL_TOP_K`` / ``RETRIEVAL_MIN_SCORE`` (env → settings) actually govern
# retrieval — including under ``override_settings`` in tests — instead of being frozen into
# module constants at import.
EMBEDDING_MODEL = getattr(settings, "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
_DEFAULT_TOP_K = 3
# cosine floor: below this a scenario / chunk is treated as irrelevant.
_DEFAULT_MIN_SCORE = 0.28
_WORD_RE = re.compile(r"\w+", re.UNICODE)


def _top_k() -> int:
    """Number of grounding snippets to return (env ``RETRIEVAL_TOP_K`` → settings)."""
    return int(getattr(settings, "RETRIEVAL_TOP_K", _DEFAULT_TOP_K))


def _min_score() -> float:
    """Cosine floor below which a match is dropped (env ``RETRIEVAL_MIN_SCORE`` → settings)."""
    return float(getattr(settings, "RETRIEVAL_MIN_SCORE", _DEFAULT_MIN_SCORE))


# Import-time snapshots kept as the module's public defaults (referenced by tests / callers
# that only need the configured value, not a per-request read).
TOP_K = _top_k()
MIN_SCORE = _min_score()


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
    """Rank stored embeddings for ``language`` by cosine similarity (pgvector ANN or brute-force)."""
    from scenarios import vectorstore
    from scenarios.models import ScenarioEmbedding

    min_score = _min_score()
    if vectorstore.pgvector_available():
        pairs = vectorstore.ann_search(query_vec, language, k)
        keep = [(eid, sim) for eid, sim in pairs if sim >= min_score]
        rows = {
            row.id: row
            for row in ScenarioEmbedding.objects.filter(
                id__in=[eid for eid, _ in keep]
            ).select_related("scenario")
        }
        return [(rows[eid].scenario, sim) for eid, sim in keep if eid in rows]

    rows = ScenarioEmbedding.objects.filter(
        language=language, scenario__is_published=True
    ).select_related("scenario")

    scored = []
    for row in rows:
        score = cosine(query_vec, row.vector)
        if score >= min_score:
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
# Knowledge Base (admin-managed sources) — same two modes as scenarios
# ---------------------------------------------------------------------------
def _vector_kb(query_vec, k):
    """Rank active KnowledgeChunk rows by cosine similarity (pgvector ANN or brute-force)."""
    from knowledge import vectorstore
    from knowledge.models import KnowledgeChunk

    min_score = _min_score()
    if vectorstore.pgvector_available():
        pairs = vectorstore.ann_search(query_vec, k)
        keep = [(cid, sim) for cid, sim in pairs if sim >= min_score]
        chunks = {
            c.id: c
            for c in KnowledgeChunk.objects.filter(
                id__in=[cid for cid, _ in keep]
            ).select_related("source")
        }
        return [(chunks[cid], sim) for cid, sim in keep if cid in chunks]

    rows = (
        KnowledgeChunk.objects.filter(source__is_active=True)
        .exclude(embedding=[])
        .select_related("source")
    )
    scored = []
    for chunk in rows:
        score = cosine(query_vec, chunk.embedding)
        if score >= min_score:
            scored.append((chunk, score))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:k]


def _keyword_kb(query, k):
    """Fallback: rank active KnowledgeChunk rows by distinct query-term overlap."""
    from knowledge.models import KnowledgeChunk

    q_tokens = _tokens(query)
    if not q_tokens:
        return []
    scored = []
    for chunk in KnowledgeChunk.objects.filter(source__is_active=True).select_related("source"):
        overlap = len(q_tokens & _tokens(chunk.text))
        if overlap:
            scored.append((chunk, float(overlap)))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:k]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def _dedup_keys(origin: str, obj) -> set:
    """Identity keys for a candidate, so the same scenario or source url can't repeat in the top.

    A scenario is keyed by its slug; a KB chunk by its source id (collapses several matching
    chunks of one source). Both also contribute their ``source_url`` when present, so a
    scenario and a KB source pointing at the *same* url deduplicate against each other too.
    A blank url is never a key (distinct url-less sources must not collapse together).
    """
    if origin == "scenario":
        keys = {("scenario", obj.slug)}
        if obj.source_url:
            keys.add(("url", obj.source_url))
        return keys
    source = obj.source
    keys = {("kb", source.id)}
    if source.url:
        keys.add(("url", source.url))
    return keys


def retrieve(query: str, language: str, k: int | None = None) -> list[dict]:
    """Return up to ``k`` grounding snippets for ``query`` in ``language``.

    Merges the Scenario Catalog and the admin Knowledge Base, ranked together in one mode
    (vector cosine, or keyword overlap as fallback), then **deduplicates**: the same scenario
    or the same source url never appears twice in the top (the highest-scored occurrence
    wins). ``k`` defaults to ``RETRIEVAL_TOP_K`` (env → settings), read here at call time.
    Each snippet: ``{origin, slug, title, text, source_url, score, mode}`` where ``origin`` is
    ``"scenario"`` or ``"kb"`` (KB snippets have ``slug=None``). Empty list means nothing
    relevant was found — the caller should then answer without grounding.
    """
    from scenarios.models import localize

    query = (query or "").strip()
    if not query:
        return []
    if k is None:
        k = _top_k()

    query_vec = embed_text(query)
    mode = "keyword"
    scenario_pairs: list = []
    kb_pairs: list = []
    if query_vec is not None:
        scenario_pairs = _vector_retrieve(query_vec, language, k)
        kb_pairs = _vector_kb(query_vec, k)
        if scenario_pairs or kb_pairs:
            mode = "vector"
    if mode == "keyword":  # no key, or vector cleared nothing — fall back to term overlap
        scenario_pairs = _keyword_retrieve(query, language, k)
        kb_pairs = _keyword_kb(query, k)

    # Merge both origins into one scored pool, tagged so we can build the snippet and derive
    # dedup keys from the underlying object. Scenarios are listed first so that on an exact
    # score tie the richer scenario (which links to /scenarios/{slug}) wins over a KB chunk.
    merged = [("scenario", obj, score) for obj, score in scenario_pairs]
    merged += [("kb", obj, score) for obj, score in kb_pairs]
    merged.sort(key=lambda item: item[2], reverse=True)

    snippets: list[dict] = []
    seen: set = set()
    for origin, obj, score in merged:
        keys = _dedup_keys(origin, obj)
        if keys & seen:  # this scenario / source url is already represented by a better score
            continue
        seen |= keys
        if origin == "scenario":
            snippets.append(
                {
                    "origin": "scenario",
                    "slug": obj.slug,
                    "title": localize(obj.title, language),
                    "text": localize(obj.body, language),
                    "source_url": obj.source_url,
                    "score": round(float(score), 4),
                    "mode": mode,
                }
            )
        else:
            source = obj.source
            snippets.append(
                {
                    "origin": "kb",
                    "slug": None,
                    "title": source.title or source.url or "Knowledge base",
                    "text": obj.text,
                    "source_url": source.url,
                    "score": round(float(score), 4),
                    "mode": mode,
                }
            )
        if len(snippets) >= k:
            break
    return snippets


def related_questions(
    query: str,
    language: str,
    k: int = 3,
    exclude_slug: str | None = None,
) -> list[dict]:
    """Return up to ``k`` catalog questions related to ``query`` in ``language``.

    Powers the "people also ask" hint shown after an assistant reply. It reuses the same
    Scenario retrieval as grounding — embed the query and rank ``ScenarioEmbedding`` vectors
    (pgvector ANN or brute-force cosine), or fall back to keyword overlap when no OpenAI key
    is configured (keyless degradation) — but keeps only the scenario *titles* and drops the
    already-asked question. The asked question is excluded two ways: any scenario whose
    localized title equals ``query`` (case-insensitively), and ``exclude_slug`` when the
    caller already knows the answer's source scenario. Results are deduplicated by slug and
    each is ``{slug, title}``. Empty list means nothing related was found.
    """
    from scenarios.models import localize

    query = (query or "").strip()
    if not query:
        return []

    # Fetch a few extra candidates so that dropping the asked question still leaves room for k.
    fetch = k + 3
    query_vec = embed_text(query)
    if query_vec is not None:
        pairs = _vector_retrieve(query_vec, language, fetch)
    else:
        pairs = _keyword_retrieve(query, language, fetch)

    asked = query.casefold()
    results: list[dict] = []
    seen: set[str] = set()
    for scenario, _score in pairs:
        if scenario.slug in seen or scenario.slug == exclude_slug:
            continue
        title = localize(scenario.title, language).strip()
        if not title or title.casefold() == asked:  # skip the already-asked question
            continue
        seen.add(scenario.slug)
        results.append({"slug": scenario.slug, "title": title})
        if len(results) >= k:
            break
    return results
