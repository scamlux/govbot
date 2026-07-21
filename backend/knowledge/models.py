"""Knowledge Base models — admin-managed grounding sources and their embedded chunks.

A ``KnowledgeSource`` is one thing the admin added (a link, an uploaded document, or pasted
text). Its extracted plain text lives in ``raw_text`` — uploads are parsed on save and the
file is discarded, because the Render web dyno has an ephemeral disk. Indexing later slices
``raw_text`` into ``KnowledgeChunk`` rows and embeds each one.

Embeddings are stored as JSON (``list[float]``) — the canonical, engine-portable form that
keeps the SQLite dev/test path working, mirroring ``scenarios.ScenarioEmbedding``. On
PostgreSQL a parallel ``embedding_vec`` pgvector column (added by migration 0002, optional)
accelerates retrieval; the JSON stays the source of truth.
"""
import hashlib

from django.db import models


class KnowledgeSource(models.Model):
    """One admin-added knowledge source (URL, uploaded document, or pasted text)."""

    URL = "url"
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    MD = "md"
    PASTE = "paste"
    SOURCE_TYPES = [
        (URL, "Web link"),
        (PDF, "PDF document"),
        (DOCX, "Word document"),
        (TXT, "Text file"),
        (MD, "Markdown file"),
        (PASTE, "Pasted text"),
    ]

    STATUS_PENDING = "pending"
    STATUS_PARSING = "parsing"
    STATUS_INDEXING = "indexing"
    STATUS_INDEXED = "indexed"
    STATUS_FAILED = "failed"
    STATUSES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PARSING, "Parsing"),
        (STATUS_INDEXING, "Indexing"),
        (STATUS_INDEXED, "Indexed"),
        (STATUS_FAILED, "Failed"),
    ]

    LANGUAGES = [
        ("auto", "Auto-detect"),
        ("uz", "Uzbek"),
        ("ru", "Russian"),
        ("en", "English"),
    ]

    source_type = models.CharField(max_length=10, choices=SOURCE_TYPES)
    title = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=1000, blank=True, help_text="For link sources; also the citation source_url.")
    original_filename = models.CharField(max_length=255, blank=True)
    raw_text = models.TextField(blank=True, help_text="Extracted plain text (uploads are parsed on save).")
    language = models.CharField(max_length=4, choices=LANGUAGES, default="auto")
    status = models.CharField(max_length=10, choices=STATUSES, default=STATUS_PENDING)
    error = models.TextField(blank=True)
    chunk_count = models.PositiveIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True, help_text="sha256 of raw_text; skips re-embed when unchanged.")
    is_active = models.BooleanField(default=True, help_text="Inactive sources are excluded from retrieval.")
    last_indexed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        label = self.title or self.url or self.original_filename or f"source #{self.pk}"
        return f"{label} [{self.status}]"

    @staticmethod
    def compute_checksum(text: str) -> str:
        """Stable sha256 hex digest of the source text (used to skip redundant re-embeds)."""
        return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


class KnowledgeChunk(models.Model):
    """One retrievable, embedded slice of a source's text."""

    source = models.ForeignKey(
        KnowledgeSource, related_name="chunks", on_delete=models.CASCADE
    )
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    token_count = models.PositiveIntegerField(default=0)
    embedding = models.JSONField(default=list, help_text="Canonical embedding vector (list[float]).")
    model = models.CharField(max_length=80, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["source", "order"]
        indexes = [models.Index(fields=["source", "order"])]

    def __str__(self) -> str:
        return f"{self.source_id}#{self.order} ({len(self.embedding)}d)"
