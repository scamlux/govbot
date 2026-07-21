import io
from types import SimpleNamespace

import pytest
from django.contrib import admin as django_admin
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory

from knowledge.admin import KnowledgeSourceAdmin
from knowledge.models import KnowledgeSource


def _make_docx(text: str) -> bytes:
    from docx import Document

    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _request_with_messages():
    request = RequestFactory().post("/")
    request.session = {}
    request._messages = FallbackStorage(request)
    return request


def test_admin_registered():
    assert KnowledgeSource in django_admin.site._registry


@pytest.mark.django_db
def test_save_paste_sets_pending():
    admin_obj = KnowledgeSourceAdmin(KnowledgeSource, AdminSite())
    obj = KnowledgeSource(source_type=KnowledgeSource.PASTE, raw_text="Some official guidance.")
    form = SimpleNamespace(cleaned_data={"upload": None}, changed_data=["raw_text"])
    admin_obj.save_model(_request_with_messages(), obj, form, change=False)
    obj.refresh_from_db()
    assert obj.status == KnowledgeSource.STATUS_PENDING


@pytest.mark.django_db
def test_save_upload_parses_and_stores_no_file():
    admin_obj = KnowledgeSourceAdmin(KnowledgeSource, AdminSite())
    obj = KnowledgeSource(source_type=KnowledgeSource.DOCX)
    upload = SimpleUploadedFile("guide.docx", _make_docx("Uploaded passport guidance"))
    form = SimpleNamespace(cleaned_data={"upload": upload}, changed_data=["source_type"])
    admin_obj.save_model(_request_with_messages(), obj, form, change=False)
    obj.refresh_from_db()
    assert "Uploaded passport guidance" in obj.raw_text
    assert obj.original_filename == "guide.docx"
    assert obj.status == KnowledgeSource.STATUS_PENDING
    # model has no FileField — nothing binary persisted
    assert not any(f.name == "file" for f in KnowledgeSource._meta.get_fields())


@pytest.mark.django_db
def test_reindex_action_sets_pending():
    src = KnowledgeSource.objects.create(
        source_type=KnowledgeSource.PASTE, raw_text="x",
        status=KnowledgeSource.STATUS_INDEXED, checksum="abc",
    )
    admin_obj = KnowledgeSourceAdmin(KnowledgeSource, AdminSite())
    admin_obj.reindex_selected(_request_with_messages(), KnowledgeSource.objects.filter(pk=src.pk))
    src.refresh_from_db()
    assert src.status == KnowledgeSource.STATUS_PENDING
    assert src.checksum == ""
