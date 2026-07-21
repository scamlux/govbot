"""Split source text into overlapping, embedding-sized chunks.

Token counting uses a whitespace-word heuristic (``len(text.split())``) rather than a real
tokenizer — it needs no extra dependency and is close enough for sizing retrieval chunks.
Chunks are packed on paragraph boundaries up to ``max_tokens`` words, with the last
``overlap`` words of each chunk repeated at the start of the next so context isn't lost at
the seams. A single paragraph longer than ``max_tokens`` is hard-split.
"""
import re

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")


def _word_count(text: str) -> int:
    return len(text.split())


def _split_units(text: str, max_tokens: int) -> list[list[str]]:
    """Break text into paragraph word-lists, hard-splitting any paragraph over max_tokens."""
    units: list[list[str]] = []
    for para in _PARAGRAPH_SPLIT.split(text):
        words = para.split()
        if not words:
            continue
        if len(words) <= max_tokens:
            units.append(words)
        else:
            for i in range(0, len(words), max_tokens):
                units.append(words[i : i + max_tokens])
    return units


def chunk_text(text: str, max_tokens: int = 800, overlap: int = 100) -> list[str]:
    """Return overlapping ~``max_tokens``-word chunks of ``text`` (``[]`` for empty input)."""
    text = (text or "").strip()
    if not text:
        return []
    max_tokens = max(1, int(max_tokens))
    overlap = max(0, min(int(overlap), max_tokens - 1))

    chunks: list[str] = []
    current: list[str] = []
    for words in _split_units(text, max_tokens):
        if current and len(current) + len(words) > max_tokens:
            chunks.append(" ".join(current))
            current = current[-overlap:] if overlap else []
        current.extend(words)
    if current:
        chunks.append(" ".join(current))
    return chunks
