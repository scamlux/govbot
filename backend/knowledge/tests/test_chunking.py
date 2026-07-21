from knowledge.chunking import chunk_text


def test_empty_input():
    assert chunk_text("") == []
    assert chunk_text("   \n\n  ") == []


def test_single_short_paragraph_one_chunk():
    assert chunk_text("A short official notice.", max_tokens=800) == ["A short official notice."]


def test_long_text_multiple_chunks_bounded():
    text = " ".join(f"word{i}" for i in range(3000))
    chunks = chunk_text(text, max_tokens=800, overlap=100)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c.split()) <= 800 + 100  # max_tokens + overlap slack


def test_consecutive_chunks_overlap():
    text = " ".join(f"w{i}" for i in range(300))
    chunks = chunk_text(text, max_tokens=100, overlap=20)
    assert len(chunks) >= 2
    first_tail = chunks[0].split()[-20:]
    second_head = chunks[1].split()[:20]
    assert first_tail == second_head


def test_huge_single_paragraph_hard_split():
    text = " ".join(f"t{i}" for i in range(2500))  # one paragraph, no blank lines
    chunks = chunk_text(text, max_tokens=500, overlap=0)
    assert len(chunks) >= 5
    assert all(c.strip() for c in chunks)


def test_no_empty_chunks():
    text = "Para one.\n\n\n\nPara two.\n\n   \n\nPara three."
    chunks = chunk_text(text, max_tokens=800)
    assert all(c.strip() for c in chunks)
