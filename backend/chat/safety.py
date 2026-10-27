"""Chat input/output hygiene helpers.

* ``mask_pii`` (F5) — redact personal identifiers before text leaves the server for the
  LLM / embedding provider. Stored messages are untouched: the user owns their own text,
  only the outbound copy is masked.
* ``sanitize_reference`` (F6) — neutralise retrieved material (catalog, knowledge base,
  live web) so it cannot break out of the delimited reference block or pose as an
  instruction. The prompt additionally tells the model the block is data, not commands.
* ``detect_language`` (A7) — a cheap heuristic that recognises the language a question is
  written in, so a tourist typing English on the Uzbek UI is answered in English.

All functions are pure and dependency-free so they are trivially unit-testable.
"""
import re

# ---------------------------------------------------------------------------
# F5 — PII masking
# ---------------------------------------------------------------------------
# Order matters: the most specific patterns run first so a 16-digit card number is not
# half-consumed by the 14-digit PINFL rule.
_PII_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("[EMAIL]", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+", re.UNICODE)),
    # Payment cards: 16 digits, optionally grouped by spaces/dashes (Uzcard/Humo/Visa/MC).
    ("[CARD]", re.compile(r"(?<!\d)(?:\d{4}[ -]?){3}\d{4}(?!\d)")),
    # Uzbek phone numbers: +998 / 998 / 8 prefix, 9 subscriber digits, loose separators.
    ("[PHONE]", re.compile(r"(?<!\d)(?:\+?998|8)[\s\-()]*(?:\d[\s\-()]*){9}(?!\d)")),
    # PINFL (personal identification number): exactly 14 digits.
    ("[PINFL]", re.compile(r"(?<!\d)\d{14}(?!\d)")),
    # Passport / ID card series: two Latin letters + 7 digits (e.g. AA1234567, AD 1234567).
    ("[PASSPORT]", re.compile(r"\b[A-Z]{2}\s?\d{7}\b")),
]


def mask_pii(text: str) -> str:
    """Replace personal identifiers in ``text`` with neutral placeholders."""
    if not text:
        return text
    for placeholder, pattern in _PII_PATTERNS:
        text = pattern.sub(placeholder, text)
    return text


# ---------------------------------------------------------------------------
# F6 — prompt-injection hardening for retrieved material
# ---------------------------------------------------------------------------
REFERENCE_OPEN = "<reference>"
REFERENCE_CLOSE = "</reference>"

# Tag-like tokens that could close/open our delimiter or impersonate a chat role.
_TAG_RE = re.compile(r"</?\s*(reference|system|assistant|user|instructions?)\s*>", re.IGNORECASE)
# Lines that start like a role header ("System:", "### Assistant") are defanged, not dropped.
_ROLE_LINE_RE = re.compile(r"^(\s*#*\s*)(system|assistant|developer)\s*:", re.IGNORECASE | re.MULTILINE)


def sanitize_reference(text: str) -> str:
    """Make retrieved text safe to embed inside the ``<reference>`` block."""
    if not text:
        return ""
    text = _TAG_RE.sub(" ", text)
    text = _ROLE_LINE_RE.sub(r"\1\2 (quoted):", text)
    return text.strip()


# ---------------------------------------------------------------------------
# A7 — language detection
# ---------------------------------------------------------------------------
_CYRILLIC_RE = re.compile(r"[Ѐ-ӿ]")
_LATIN_RE = re.compile(r"[A-Za-z]")
# Letters that exist in Uzbek Cyrillic but not in Russian.
_UZ_CYRILLIC_RE = re.compile(r"[ўқғҳЎҚҒҲ]")
_WORD_RE = re.compile(r"[a-zʻʼ'‘’`]+", re.IGNORECASE)

_UZ_MARKERS = {
    "va", "uchun", "qanday", "qayerda", "qachon", "nima", "nimalar", "kerak", "bilan",
    "qilish", "qilsam", "olish", "olsam", "mumkin", "emas", "men", "menga", "siz",
    "sizga", "hujjat", "hujjatlar", "hujjatlari", "ro'yxat", "ro'yxatdan", "o'tish",
    "o'tkazish", "pasport", "pasportni", "viza", "vizasi", "soliq", "soliqlar", "qancha",
    "bo'ladi", "bo'lsa", "yo'q", "ham", "yoki", "agar", "kerakmi", "beraman", "bering",
    "haqida", "xizmat", "xizmatlari", "davlat", "uy", "joy", "qayta", "yangilash",
    "berish", "to'lov", "muddat", "muddati", "ishlash", "chet", "fuqaro", "fuqarosi",
}
_EN_MARKERS = {
    "the", "how", "what", "where", "when", "which", "who", "why", "do", "does", "is",
    "are", "can", "could", "should", "i", "my", "me", "you", "your", "to", "for", "of",
    "in", "a", "an", "and", "need", "get", "renew", "register", "apply", "visa",
    "passport", "tax", "taxes", "business", "license", "permit", "much", "cost", "long",
    "take", "documents", "required", "tourist", "foreigner", "with", "it", "this",
}
_APOSTROPHES = str.maketrans({"ʻ": "'", "ʼ": "'", "‘": "'", "’": "'", "`": "'"})


def detect_language(text: str) -> str | None:
    """Best-effort guess of ``uz`` / ``ru`` / ``en`` for ``text``; ``None`` when unsure.

    Script decides first (Cyrillic → ru, or uz when Uzbek-only letters appear); for Latin
    text, Uzbek and English function words are counted and the clear winner returned.
    Short or ambiguous text returns ``None`` so the caller keeps the UI language.
    """
    if not text or not text.strip():
        return None
    cyr = len(_CYRILLIC_RE.findall(text))
    lat = len(_LATIN_RE.findall(text))
    if cyr == 0 and lat == 0:
        return None
    if cyr > lat:
        return "uz" if _UZ_CYRILLIC_RE.search(text) else "ru"

    words = [w.lower() for w in _WORD_RE.findall(text.translate(_APOSTROPHES))]
    if not words:
        return None
    uz_hits = sum(1 for w in words if w in _UZ_MARKERS)
    # Uzbek Latin orthography: o' / g' digraphs are a strong signal on their own.
    uz_hits += sum(1 for w in words if "o'" in w or "g'" in w)
    en_hits = sum(1 for w in words if w in _EN_MARKERS)
    if uz_hits == en_hits:
        return None
    winner, best, other = ("uz", uz_hits, en_hits) if uz_hits > en_hits else ("en", en_hits, uz_hits)
    # Require a margin so a single shared token ("viza"/"visa") can't flip the language.
    if best >= 2 and best >= other * 2:
        return winner
    return None


def resolve_reply_language(text: str, ui_language: str) -> str:
    """The language to answer in: the detected one when confident, else the UI language."""
    detected = detect_language(text)
    return detected or ui_language


# ---------------------------------------------------------------------------
# R4 — apostrophe normalisation for Uzbek search
# ---------------------------------------------------------------------------
def normalize_apostrophes(text: str) -> str:
    """Fold the many Uzbek apostrophe variants (ʻ ʼ ‘ ’ `) to ASCII ``'``.

    The catalog content uses ASCII apostrophes, so a user typing ``oʻ`` or ``o’`` on a
    phone keyboard would otherwise miss every ``o'`` match.
    """
    return (text or "").translate(_APOSTROPHES)
