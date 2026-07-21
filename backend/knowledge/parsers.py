"""Extract plain text from the document types the Knowledge Base accepts.

Each parser takes raw ``bytes`` (as uploaded) and returns clean UTF-8 text. Failures raise
``ParseError`` so the caller can mark the source ``failed`` with a readable message rather
than crashing indexing.
"""
import io
import logging
import re

logger = logging.getLogger(__name__)


class ParseError(Exception):
    """Raised when a document cannot be parsed into text."""


def parse_pdf(data: bytes) -> str:
    """Concatenate the extractable text of every page in a PDF."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        parts = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:  # noqa: BLE001
        raise ParseError(f"PDF parse failed: {exc}") from exc
    return _normalize("\n\n".join(p for p in parts if p.strip()))


def parse_docx(data: bytes) -> str:
    """Join the paragraph text of a .docx document."""
    from docx import Document

    try:
        doc = Document(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
    except Exception as exc:  # noqa: BLE001
        raise ParseError(f"DOCX parse failed: {exc}") from exc
    return _normalize("\n".join(parts))


def parse_text(data: bytes) -> str:
    """Decode a text / markdown file (UTF-8, lenient)."""
    if isinstance(data, str):
        return _normalize(data)
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("utf-8", errors="replace")
    return _normalize(text)


def extract_html(html: str) -> str:
    """Extract the main readable text from an HTML page (drops nav/scripts/boilerplate)."""
    try:
        import trafilatura

        text = trafilatura.extract(html, include_comments=False, include_tables=True)
        if text and text.strip():
            return _normalize(text)
    except Exception:  # noqa: BLE001 — fall through to tag-strip
        logger.debug("trafilatura extraction failed; using tag-strip fallback")
    return _strip_tags(html)


def _strip_tags(html: str) -> str:
    """Fallback HTML → text: drop script/style, collapse whitespace."""
    try:
        from lxml import html as lxml_html

        doc = lxml_html.fromstring(html)
        for bad in doc.xpath("//script | //style | //noscript"):
            bad.drop_tree()
        return _normalize(doc.text_content())
    except Exception:  # noqa: BLE001 — regex last resort
        no_code = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html or "", flags=re.S | re.I)
        return _normalize(re.sub(r"<[^>]+>", " ", no_code))


def _normalize(text: str) -> str:
    """Collapse runs of blank lines / whitespace while keeping paragraph breaks."""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
