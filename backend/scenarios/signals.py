"""Keep scenario embeddings in sync with scenario content.

On save we refresh the vectors so the RAG grounding always reflects the latest catalog
text. Failures are logged, never raised — an embedding hiccup must not block an editor from
saving a scenario. Deletes are handled by the FK cascade on ``ScenarioEmbedding``.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .embeddings import embed_scenario
from .models import Scenario

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Scenario)
def refresh_scenario_embeddings(sender, instance, **kwargs):
    try:
        embed_scenario(instance)
    except Exception:  # noqa: BLE001 — never let embedding failure break a save
        logger.exception("Failed to refresh embeddings for scenario %s", instance.slug)
