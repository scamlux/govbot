"""(Re)computing stored embeddings for scenarios.

Kept out of ``models.py`` so the OpenAI call lives in one place and can be triggered from
both the post-save signal and the ``embed_scenarios`` management command. The actual
embedding call is delegated to ``chat.retrieval`` (single owner of the OpenAI client).
"""
import logging

from .models import LANGUAGE_CODES, ScenarioEmbedding

logger = logging.getLogger(__name__)


def embed_scenario(scenario) -> int:
    """(Re)compute and upsert embeddings for every language of one scenario.

    Returns the number of vectors written. A no-op returning 0 when embeddings are
    disabled (mock mode / no OpenAI key) — in that case chat grounding uses keyword search.
    """
    from chat import retrieval

    if not retrieval.embeddings_enabled():
        return 0

    written = 0
    for lang in LANGUAGE_CODES:
        text = scenario.embedding_source_text(lang)
        if not text:
            # No content for this language → drop any stale vector.
            ScenarioEmbedding.objects.filter(scenario=scenario, language=lang).delete()
            continue
        vector = retrieval.embed_text(text)
        if vector is None:
            continue
        ScenarioEmbedding.objects.update_or_create(
            scenario=scenario,
            language=lang,
            defaults={"vector": vector, "model": retrieval.EMBEDDING_MODEL},
        )
        written += 1
    return written
