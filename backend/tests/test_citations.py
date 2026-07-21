"""B2 — typed source citations (scenario | kb) with legacy fallback + dedupe."""
from chat.services import sources_from_snippets


def test_scenario_source_has_type_and_slug():
    out = sources_from_snippets(
        [{"origin": "scenario", "slug": "passport", "title": "P", "source_url": "u"}]
    )
    assert out == [{"type": "scenario", "slug": "passport", "title": "P", "source_url": "u"}]


def test_kb_source_has_type_and_no_slug():
    out = sources_from_snippets(
        [{"origin": "kb", "slug": None, "title": "Tax note", "source_url": "https://soliq.uz"}]
    )
    assert out == [{"type": "kb", "title": "Tax note", "source_url": "https://soliq.uz"}]
    assert "slug" not in out[0]


def test_legacy_snippet_defaults_to_scenario():
    out = sources_from_snippets([{"slug": "x", "title": "T", "source_url": "u"}])
    assert out[0]["type"] == "scenario"
    assert out[0]["slug"] == "x"


def test_dedupe_within_each_type_preserves_order():
    out = sources_from_snippets(
        [
            {"origin": "scenario", "slug": "a", "title": "A", "source_url": ""},
            {"origin": "kb", "slug": None, "title": "K", "source_url": "https://k"},
            {"origin": "scenario", "slug": "a", "title": "A", "source_url": ""},
            {"origin": "kb", "slug": None, "title": "K", "source_url": "https://k"},
        ]
    )
    assert [s["type"] for s in out] == ["scenario", "kb"]
