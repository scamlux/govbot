"""Django admin for the Knowledge Base.

Admins add a source as a URL, a pasted text, or an uploaded document. Uploaded files are
parsed to text on save and NOT stored (the model has no FileField — the Render dyno disk is
ephemeral). Any content change flips the source to ``pending`` so the next reindex tick picks
it up. Chunks are shown read-only for debugging.
"""
from django import forms
from django.contrib import admin

from . import parsers
from .models import KnowledgeChunk, KnowledgeSource


class KnowledgeSourceForm(forms.ModelForm):
    upload = forms.FileField(
        required=False,
        help_text="Upload a PDF / DOCX / TXT / MD — parsed to text on save; the file itself is not stored.",
    )

    class Meta:
        model = KnowledgeSource
        fields = "__all__"


class KnowledgeChunkInline(admin.TabularInline):
    model = KnowledgeChunk
    extra = 0
    can_delete = False
    fields = ("order", "token_count", "model", "text")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(KnowledgeSource)
class KnowledgeSourceAdmin(admin.ModelAdmin):
    form = KnowledgeSourceForm
    list_display = ("__str__", "source_type", "status", "chunk_count", "language", "is_active", "updated_at")
    list_filter = ("source_type", "status", "is_active", "language")
    search_fields = ("title", "url", "raw_text")
    readonly_fields = ("status", "error", "chunk_count", "checksum", "last_indexed_at", "created_at", "updated_at")
    inlines = [KnowledgeChunkInline]
    actions = ["reindex_selected", "deactivate_selected"]

    @staticmethod
    def _parse_upload(source_type: str, filename: str, data: bytes) -> str:
        name = (filename or "").lower()
        if source_type == KnowledgeSource.PDF or name.endswith(".pdf"):
            return parsers.parse_pdf(data)
        if source_type == KnowledgeSource.DOCX or name.endswith(".docx"):
            return parsers.parse_docx(data)
        return parsers.parse_text(data)

    def save_model(self, request, obj, form, change):
        upload = form.cleaned_data.get("upload")
        parse_error = None
        if upload:
            data = upload.read()
            obj.original_filename = upload.name
            try:
                obj.raw_text = self._parse_upload(obj.source_type, upload.name, data)
            except Exception as exc:  # noqa: BLE001 — surface as a failed source, not a 500
                parse_error = str(exc)

        content_changed = (
            not change
            or bool(upload)
            or any(f in form.changed_data for f in ("raw_text", "url", "source_type"))
        )
        if parse_error is not None:
            obj.status = KnowledgeSource.STATUS_FAILED
            obj.error = parse_error[:2000]
        elif content_changed:
            obj.status = KnowledgeSource.STATUS_PENDING
            obj.checksum = ""
            obj.error = ""
        super().save_model(request, obj, form, change)

    @admin.action(description="Reindex selected sources")
    def reindex_selected(self, request, queryset):
        updated = queryset.update(status=KnowledgeSource.STATUS_PENDING, checksum="", error="")
        self.message_user(request, f"{updated} source(s) queued for reindex.")

    @admin.action(description="Deactivate selected sources")
    def deactivate_selected(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} source(s) deactivated.")
