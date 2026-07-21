import io

from knowledge.parsers import extract_html, parse_docx, parse_pdf, parse_text


def _make_pdf(text: str) -> bytes:
    """Build a minimal single-page PDF whose page shows ``text`` (pypdf-extractable)."""
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
    ]
    stream = b"BT /F1 24 Tf 72 720 Td (" + text.encode("latin-1") + b") Tj ET"
    objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref_pos = out.tell()
    out.write(b"xref\n0 " + str(len(objs) + 1).encode() + b"\n0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(
        b"trailer\n<< /Size " + str(len(objs) + 1).encode() + b" /Root 1 0 R >>\n"
        b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF"
    )
    return out.getvalue()


def _make_docx(text: str) -> bytes:
    from docx import Document

    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_parse_pdf():
    assert "Hello PDF grounding" in parse_pdf(_make_pdf("Hello PDF grounding"))


def test_parse_docx():
    assert "Passport renewal steps" in parse_docx(_make_docx("Passport renewal steps"))


def test_parse_text_utf8():
    assert parse_text("Регистрация — bo'yicha".encode("utf-8")) == "Регистрация — bo'yicha"


def test_parse_text_accepts_str():
    assert parse_text("plain") == "plain"


def test_extract_html_drops_scripts():
    result = extract_html("<p>Hello world grounding</p><script>alert('x')</script>")
    assert "Hello world grounding" in result
    assert "alert" not in result


def test_extract_html_main_article():
    html = (
        "<html><body><nav>Menu Home About</nav>"
        "<article><p>" + ("Official passport renewal guidance. " * 20) + "</p></article>"
        "<footer>Copyright</footer></body></html>"
    )
    text = extract_html(html)
    assert "passport renewal guidance" in text
