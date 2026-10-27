"""E3 — staff-only REST API for the Knowledge Base, used by the in-app admin tab.

Mirrors the Django-admin behaviour (``knowledge/admin.py``): a source is a web link, pasted
text or an uploaded document; uploads are parsed to text on create and the file is not
kept (the Render disk is ephemeral). Any create/content change queues the source as
``pending`` so the existing indexing tick (``internal/kb/tick/`` / ``index_kb``) picks it up.
"""
from django.conf import settings
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from . import parsers
from .models import KnowledgeSource


class KnowledgeSourceSerializer(serializers.ModelSerializer):
    upload = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = KnowledgeSource
        fields = [
            "id",
            "source_type",
            "title",
            "url",
            "original_filename",
            "raw_text",
            "language",
            "status",
            "error",
            "chunk_count",
            "is_active",
            "last_indexed_at",
            "created_at",
            "updated_at",
            "upload",
        ]
        read_only_fields = [
            "original_filename",
            "status",
            "error",
            "chunk_count",
            "last_indexed_at",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"raw_text": {"required": False, "allow_blank": True}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # The list view must stay light: ship a preview, not whole documents.
        text = data.get("raw_text") or ""
        data["raw_text"] = text[:500]
        data["raw_text_length"] = len(text)
        return data

    def validate(self, attrs):
        source_type = attrs.get("source_type") or getattr(self.instance, "source_type", None)
        upload = attrs.get("upload")
        if source_type == KnowledgeSource.URL and not (attrs.get("url") or getattr(self.instance, "url", "")):
            raise ValidationError({"url": "A web link source needs a URL."})
        if source_type == KnowledgeSource.PASTE and not (
            attrs.get("raw_text") or getattr(self.instance, "raw_text", "")
        ):
            raise ValidationError({"raw_text": "Pasted text cannot be empty."})
        if source_type in (KnowledgeSource.PDF, KnowledgeSource.DOCX, KnowledgeSource.TXT, KnowledgeSource.MD):
            if not upload and not self.instance:
                raise ValidationError({"upload": "Attach a file for document sources."})
        if upload:
            max_mb = getattr(settings, "KB_MAX_FILE_MB", 10)
            if upload.size > max_mb * 1024 * 1024:
                raise ValidationError({"upload": f"File is larger than {max_mb} MB."})
        return attrs

    @staticmethod
    def _parse(source_type: str, filename: str, data: bytes) -> str:
        name = (filename or "").lower()
        if source_type == KnowledgeSource.PDF or name.endswith(".pdf"):
            return parsers.parse_pdf(data)
        if source_type == KnowledgeSource.DOCX or name.endswith(".docx"):
            return parsers.parse_docx(data)
        return parsers.parse_text(data)

    def _apply_upload(self, instance, upload):
        instance.original_filename = upload.name
        try:
            instance.raw_text = self._parse(instance.source_type, upload.name, upload.read())
            instance.status = KnowledgeSource.STATUS_PENDING
            instance.error = ""
        except Exception as exc:  # noqa: BLE001 — surface as a failed source, not a 500
            instance.status = KnowledgeSource.STATUS_FAILED
            instance.error = str(exc)[:2000]

    def create(self, validated_data):
        upload = validated_data.pop("upload", None)
        instance = KnowledgeSource(**validated_data)
        instance.status = KnowledgeSource.STATUS_PENDING
        if upload:
            self._apply_upload(instance, upload)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        upload = validated_data.pop("upload", None)
        content_changed = any(
            f in validated_data and validated_data[f] != getattr(instance, f)
            for f in ("raw_text", "url", "source_type")
        )
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if upload:
            self._apply_upload(instance, upload)
        elif content_changed:
            instance.status = KnowledgeSource.STATUS_PENDING
            instance.checksum = ""
            instance.error = ""
        instance.save()
        return instance


class AdminKnowledgeSourceViewSet(viewsets.ModelViewSet):
    """``/api/admin/kb/sources/`` — list/create/update/delete + ``reindex`` (staff only)."""

    permission_classes = [IsAdminUser]
    serializer_class = KnowledgeSourceSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = KnowledgeSource.objects.order_by("-updated_at")

    @action(detail=True, methods=["post"])
    def reindex(self, request, pk=None):
        source = self.get_object()
        source.status = KnowledgeSource.STATUS_PENDING
        source.checksum = ""
        source.error = ""
        source.save(update_fields=["status", "checksum", "error", "updated_at"])
        return Response(self.get_serializer(source).data, status=status.HTTP_202_ACCEPTED)
