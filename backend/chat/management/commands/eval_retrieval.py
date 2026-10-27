"""A4 — retrieval evaluation harness.

    python manage.py eval_retrieval                 # current settings
    python manage.py eval_retrieval --top-k 5 --min-score 0.2
    python manage.py eval_retrieval --sweep          # grid over TOP_K × MIN_SCORE
    python manage.py eval_retrieval --show-misses

Runs every golden question (``chat/eval_golden.py``) through ``retrieval.retrieve`` and
reports recall@k (a hit = any expected slug among the returned scenario slugs) and the
ungrounded rate (no snippet at all). Works in both modes: keyword without a key, vector
with ``OPENAI_API_KEY`` — so the same harness tunes ``RETRIEVAL_TOP_K`` /
``RETRIEVAL_MIN_SCORE`` before changing them in production.
"""
from django.core.management.base import BaseCommand
from django.test import override_settings

from chat import retrieval
from chat.eval_golden import GOLDEN


def evaluate(cases=GOLDEN) -> dict:
    hits = ungrounded = 0
    misses = []
    for case in cases:
        snippets = retrieval.retrieve(case["q"], case["lang"])
        slugs = [s.get("slug") for s in snippets if s.get("slug")]
        if not snippets:
            ungrounded += 1
        if any(slug in case["expect"] for slug in slugs):
            hits += 1
        else:
            misses.append({"q": case["q"], "expect": case["expect"], "got": slugs})
    total = len(cases) or 1
    return {
        "mode": "vector" if retrieval.embeddings_enabled() else "keyword",
        "cases": len(cases),
        "recall": hits / total,
        "ungrounded_rate": ungrounded / total,
        "misses": misses,
    }


class Command(BaseCommand):
    help = "Measure retrieval recall@k on the golden question set (A4)."

    def add_arguments(self, parser):
        parser.add_argument("--top-k", type=int, default=None)
        parser.add_argument("--min-score", type=float, default=None)
        parser.add_argument("--sweep", action="store_true")
        parser.add_argument("--show-misses", action="store_true")

    def _run(self, top_k, min_score, show_misses):
        overrides = {}
        if top_k is not None:
            overrides["RETRIEVAL_TOP_K"] = top_k
        if min_score is not None:
            overrides["RETRIEVAL_MIN_SCORE"] = min_score
        with override_settings(**overrides):
            result = evaluate()
            k = retrieval._top_k()
            score = retrieval._min_score()
        self.stdout.write(
            f"mode={result['mode']:7} top_k={k} min_score={score:.2f}  "
            f"recall@k={result['recall']:.0%}  ungrounded={result['ungrounded_rate']:.0%}  "
            f"({result['cases']} cases)"
        )
        if show_misses:
            for miss in result["misses"]:
                self.stdout.write(f"  MISS  {miss['q']!r}  expected={miss['expect']}  got={miss['got']}")
        return result

    def handle(self, *args, **opts):
        if opts["sweep"]:
            for k in (1, 3, 5):
                for score in (0.2, 0.28, 0.35):
                    self._run(k, score, False)
            return
        self._run(opts["top_k"], opts["min_score"], opts["show_misses"])
