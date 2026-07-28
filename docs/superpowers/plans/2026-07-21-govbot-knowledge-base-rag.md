# GovBot Knowledge Base + Hybrid RAG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin build a Knowledge Base (URL / PDF / DOCX / TXT / MD / paste) that grounds GovBot's AI, on top of the scenario catalog, with an opt-in live web-search fallback.

**Architecture:** New `knowledge` Django app stores sources + embedded chunks. Parse-on-upload (text into Postgres, file discarded). Worker-less indexing drained by bounded ticks (`pg_cron` → secret endpoint) + a management command. Retrieval merges scenario + KB hits; pgvector ANN when available, brute-force cosine otherwise (SQLite/dev, or Postgres pre-cutover). Live fallback (Tavily) fires only when nothing is retrieved and a provider is configured.

**Tech Stack:** Django 5.1 + DRF, PostgreSQL + pgvector (Supabase free) / SQLite dev, OpenAI embeddings, httpx + trafilatura / pypdf / python-docx, React + i18next frontend.

## Global Constraints

- Python 3.12+ target; runs on the repo `.venv` (3.14). Django 5.1.4, DRF 3.15.2.
- **Tests forced onto SQLite** by `conftest.py`; OpenAI in mock mode (`OPENAI_API_KEY=""`). Every task's tests must pass there.
- **Code must run on any DB**: SQLite, Postgres-without-pgvector, Postgres-with-pgvector. pgvector is an opt-in acceleration, never a hard dependency.
- Language fallback order everywhere: requested → uz → en → ru → first available.
- 0 Sonar bugs/vulns/smells. Server-side URL fetch MUST be SSRF-guarded.
- Multilingual JSON fields keyed by `{uz,ru,en}`. Commit small and often.
- No secrets committed; every new env var documented in `.env.example` + CLAUDE.md §6.

---

## Phase A — Ingestion & storage

### Task A1: dependencies + `knowledge` app skeleton

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/knowledge/__init__.py`, `apps.py`, `models.py` (empty for now), `admin.py`, `migrations/__init__.py`
- Modify: `backend/config/settings.py` (add `"knowledge"` to `INSTALLED_APPS`)

- [ ] **Step 1:** Append to `requirements.txt`: `httpx==0.28.1`, `trafilatura==2.0.0`, `pypdf==5.1.0`, `python-docx==1.1.2`, `pgvector==0.3.6`. Install: `.venv/bin/pip install -r requirements.txt`.
- [ ] **Step 2:** Create app skeleton (`KnowledgeConfig`, `default_auto_field`). Add to `INSTALLED_APPS` after `"scenarios"`.
- [ ] **Step 3:** Run `.venv/bin/python -m pytest -q -p no:warnings` → still 61 pass (no regressions).
- [ ] **Step 4:** Commit `feat(kb): scaffold knowledge app + ingestion deps`.

### Task A2: `KnowledgeSource` + `KnowledgeChunk` models + core migration

**Files:**
- Modify: `backend/knowledge/models.py`
- Test: `backend/knowledge/tests/test_models.py`

**Interfaces — Produces:**
- `KnowledgeSource(source_type, title, url, original_filename, raw_text, language, status, error, chunk_count, checksum, is_active, created_at, updated_at)` with `SOURCE_TYPES`, `STATUS_*` constants.
- `KnowledgeChunk(source FK, order, text, token_count, embedding: JSONField list[float], model, updated_at)`.
- `KnowledgeSource.compute_checksum(text) -> str` (sha256 hex).

- [ ] **Step 1 (test):** assert a source defaults to `status="pending"`, `is_active=True`, `chunk_count=0`; `compute_checksum("a") == compute_checksum("a")` and differs for `"b"`.
- [ ] **Step 2:** run test → fails (no model).
- [ ] **Step 3:** implement both models (JSONField `embedding`, `default=list`), constants, `compute_checksum` staticmethod; `KnowledgeChunk.Meta.ordering = ["source", "order"]`; index on `(source, order)`.
- [ ] **Step 4:** `.venv/bin/python manage.py makemigrations knowledge` then `pytest backend/knowledge/tests/test_models.py -q` → pass.
- [ ] **Step 5:** Commit `feat(kb): KnowledgeSource + KnowledgeChunk models`.

### Task A3: document parsers

**Files:**
- Create: `backend/knowledge/parsers.py`
- Test: `backend/knowledge/tests/test_parsers.py` + fixtures `backend/knowledge/tests/fixtures/{sample.pdf,sample.docx,sample.md}`

**Interfaces — Produces:**
- `parse_pdf(data: bytes) -> str`
- `parse_docx(data: bytes) -> str`
- `parse_text(data: bytes) -> str` (utf-8, lenient)
- `extract_html(html: str) -> str` (trafilatura main-text, fallback tag-strip)

- [ ] **Step 1 (test):** generate tiny fixtures in a `conftest`-style helper (build docx via `python-docx`, pdf via `pypdf`), assert each parser returns text containing a known sentence; `extract_html("<p>Hello</p><script>x</script>")` returns `"Hello"` without script.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement parsers. `extract_html`: `trafilatura.extract(html) or _strip_tags(html)`.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): pdf/docx/text/html parsers`.

### Task A4: SSRF-guarded URL fetcher

**Files:**
- Create: `backend/knowledge/fetch.py`
- Test: `backend/knowledge/tests/test_fetch.py`

**Interfaces — Produces:**
- `class UnsafeURLError(Exception)`
- `is_public_host(host: str) -> bool` — resolves host, False if any IP is loopback/private/link-local/reserved/multicast/unspecified.
- `fetch_url(url: str) -> tuple[str, bytes]` — returns `(content_type, body)`; raises `UnsafeURLError` on scheme≠http(s), private host, oversize, bad content-type; enforces timeout, max bytes, manual redirects (≤3, each re-validated).

- [ ] **Step 1 (test):** `is_public_host("127.0.0.1")`, `("10.0.0.1")`, `("169.254.1.1")`, `("::1")`, `("localhost")` all False; `is_public_host("93.184.216.34")` True. `fetch_url("ftp://x")` and `fetch_url("http://127.0.0.1/")` raise `UnsafeURLError`. (Network calls mocked/patched — no real requests.)
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement using `socket.getaddrinfo` + `ipaddress.ip_address(...).is_*`; `httpx.Client(follow_redirects=False)` loop; size cap by streaming; content-type allowlist `{text/html, text/plain, application/pdf}`.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): SSRF-guarded URL fetcher`.

### Task A5: chunking

**Files:**
- Create: `backend/knowledge/chunking.py`
- Test: `backend/knowledge/tests/test_chunking.py`

**Interfaces — Produces:**
- `chunk_text(text: str, max_tokens: int = 800, overlap: int = 100) -> list[str]` — splits on blank-line/paragraph boundaries, packs to ~max_tokens (whitespace≈token heuristic via `len(s.split())`), overlaps by `overlap` tokens; never returns empty strings; single huge paragraph is hard-split.

- [ ] **Step 1 (test):** a 3000-word text yields >1 chunk, each ≤ ~ (max_tokens+paragraph slack) words, consecutive chunks share overlap words; empty/whitespace input → `[]`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): token-aware chunking`.

### Task A6: indexing (chunk → embed → store) + `run_kb_tick`

**Files:**
- Create: `backend/knowledge/indexing.py`
- Modify: `backend/config/settings.py` (KB_* tunables)
- Test: `backend/knowledge/tests/test_indexing.py`

**Interfaces — Consumes:** `chat.retrieval.embed_texts`, parsers, chunking, models.
**Interfaces — Produces:**
- `index_source(source: KnowledgeSource) -> int` — (re)builds chunks for one source: ensures `raw_text` (parse `url` sources via `fetch_url`+parsers if empty), chunk, embed in batches (`KB_EMBED_BATCH`), replace chunks atomically, set `chunk_count/checksum/status=indexed/error=""`; returns chunk count. On failure sets `status="failed"`, stores `error`, re-raises-safe (no crash). Skips re-embed when `checksum` unchanged and chunks exist.
- `run_kb_tick(limit: int = 1) -> dict` — pick up to `limit` sources needing work (`status in {pending}` or stale), index each, return `{"processed": n, "failed": m}`.

- [ ] **Step 1 (test):** create a `paste` source with `raw_text`; monkeypatch `embed_texts` to return deterministic vectors; `index_source` → status `indexed`, `chunk_count>0`, chunks have `embedding` lists. Re-running with same text does not re-embed (assert embed call count). A source that raises during embed → `status="failed"`, `error` populated, no exception bubbles. `run_kb_tick(limit=1)` processes exactly one pending source.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement; wrap chunk replace in `transaction.atomic`. Add settings: `KB_CHUNK_TOKENS=800`, `KB_CHUNK_OVERLAP=100`, `KB_EMBED_BATCH=64`, `KB_TICK_BATCH=1`, `KB_FETCH_TIMEOUT=15`, `KB_FETCH_MAX_BYTES=5242880`, `KB_MAX_FILE_MB=20` (all `env(...)`).
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): source indexing + bounded reindex tick`.

### Task A7: `reindex_kb` command + secret tick endpoint

**Files:**
- Create: `backend/knowledge/management/commands/reindex_kb.py`
- Create: `backend/knowledge/views.py`, `backend/knowledge/urls.py`
- Modify: `backend/config/urls.py` (include under `/api/`), `backend/config/settings.py` (`KB_TICK_SECRET`)
- Test: `backend/knowledge/tests/test_tick_endpoint.py`

**Interfaces — Produces:**
- `POST /api/internal/kb/tick/` — header `X-KB-Tick-Secret`; 403 when missing/wrong or when `KB_TICK_SECRET` unset; else runs `run_kb_tick(KB_TICK_BATCH)` and returns `{"processed","failed"}`. `AllowAny` + manual secret check (called by pg_net, not JWT).
- `reindex_kb [--source ID] [--all]` management command.

- [ ] **Step 1 (test):** POST without header → 403; with correct secret → 200 + JSON; when `KB_TICK_SECRET=""` any call → 403.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement; use `hmac.compare_digest`.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): reindex command + secret tick endpoint`.

### Task A8: admin

**Files:**
- Modify: `backend/knowledge/admin.py`
- Test: `backend/knowledge/tests/test_admin.py`

- [ ] **Step 1 (test):** admin registered; a `save` of a `paste` source with `raw_text` sets `status="pending"`; "Reindex selected" action flips sources to `pending`. Upload handling: a `save` with an in-memory file parses to `raw_text` and clears the file (assert no FileField persisted).
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement `KnowledgeSourceAdmin` (list_display, list_filter, search, readonly `error/chunk_count/checksum/updated_at`, actions `reindex_selected`, `deactivate`), a non-model `upload` form field handled in `save_model` (parse via `source_type`), read-only `KnowledgeChunk` inline.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): admin source management`.

### Task A9: pgvector acceleration (opt-in, Postgres-only)

**Files:**
- Create: `backend/knowledge/migrations/0002_pgvector.py` (RunSQL, reversible, guarded)
- Create: `backend/knowledge/vectorstore.py`
- Test: `backend/knowledge/tests/test_vectorstore.py`

**Interfaces — Produces:**
- `pgvector_available(connection) -> bool` — Postgres + `vector` extension present.
- `sync_chunk_vector(chunk)` / `sync_source_vectors(source)` — write `embedding_vec` from JSON (no-op when unavailable).
- `ann_search(query_vec, k) -> list[tuple[chunk_id, distance]]` — pgvector `<=>` query (only called when available).
- Migration `0002`: on Postgres with pgvector, `CREATE EXTENSION IF NOT EXISTS vector`, `ALTER TABLE ... ADD COLUMN embedding_vec vector(1536)`, HNSW index; **no-op on SQLite and on Postgres where the extension can't be created** (wrap in savepoint + catch). Reverse drops column/index.

- [ ] **Step 1 (test):** on SQLite, `pgvector_available(connection)` is False, `sync_chunk_vector` is a no-op (no error), migration `0002` applied cleanly (already run by test DB setup). Guard logic unit-tested by faking `connection.vendor`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement; indexing (A6) calls `sync_source_vectors` after storing chunks.
- [ ] **Step 4:** tests pass (SQLite path).
- [ ] **Step 5:** Commit `feat(kb): optional pgvector acceleration (guarded)`.

---

## Phase B — retrieval merge & citations

### Task B1: merge KB into retrieval

**Files:**
- Modify: `backend/chat/retrieval.py`
- Test: `backend/chat/tests/test_kb_retrieval.py` (or extend `tests/test_retrieval.py`)

**Interfaces — Consumes:** `knowledge.vectorstore.{pgvector_available,ann_search}`, `KnowledgeChunk`.
**Interfaces — Produces:** `retrieve(query, language, k)` snippet dicts gain `origin: "scenario"|"kb"`. KB ranking: `ann_search` when pgvector available, else brute-force cosine over `embedding` JSON (active sources only), else keyword overlap in mock mode. Scores normalized to [0,1] before merge; global top-K by `RETRIEVAL_TOP_K`, floor `RETRIEVAL_MIN_SCORE`.

- [ ] **Step 1 (test):** seed one scenario + one KB source (mock embeddings) both relevant to a query; `retrieve` returns both with `origin` set, sorted by score, respecting top-K and min-score; inactive KB sources excluded.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement brute-force KB path mirroring the scenario cosine; merge + normalize.
- [ ] **Step 4:** tests pass. Full suite green.
- [ ] **Step 5:** Commit `feat(kb): merge KB chunks into RAG retrieval`.

### Task B2: citation `type` discriminator through services + persistence

**Files:**
- Modify: `backend/chat/services.py` (`sources_from_snippets`, `_format_reference`)
- Test: extend `backend/chat/tests/test_chat.py`

**Interfaces — Produces:** `sources_from_snippets(snippets)` emits items with `type`: `{"type":"scenario","slug","title","source_url"}` or `{"type":"kb","title","source_url"}`. Persisted in `Message.sources`. Reference block cites KB sources by title + url.

- [ ] **Step 1 (test):** snippets with mixed `origin` → sources carry correct `type`; KB item has no `slug`; a legacy snippet without `origin` defaults to `scenario`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(kb): typed source citations (scenario|kb)`.

### Task B3: frontend chips render KB/web sources

**Files:**
- Modify: the sources-chips component (`frontend/src/components/…` — locate via `sources`), `frontend/src/i18n/{uz,ru,en}.json`
- Test: manual + `npm run build`

**Interfaces — Consumes:** `sources[].type`.

- [ ] **Step 1:** render `scenario` → internal `/scenarios/{slug}` + external `source_url`; `kb` → external `source_url` only (new tab, `rel="noopener"`); unknown/missing type → treat as `scenario`. Add i18n label for a source badge.
- [ ] **Step 2:** `cd frontend && npm run build` → succeeds, no type errors.
- [ ] **Step 3:** Commit `feat(kb): render KB source chips`.

---

## Phase C — live web-search fallback (opt-in)

### Task C1: pluggable search provider (Tavily)

**Files:**
- Create: `backend/chat/search.py`
- Modify: `backend/config/settings.py` (`KB_SEARCH_PROVIDER`, `TAVILY_API_KEY`, `KB_SEARCH_DOMAINS`, `KB_SEARCH_MAX_RESULTS`)
- Test: `backend/chat/tests/test_search.py`

**Interfaces — Produces:**
- `web_search(query, language) -> list[dict]` — `[]` when `KB_SEARCH_PROVIDER=="none"`; else Tavily over `httpx` (POST, `include_domains` from `KB_SEARCH_DOMAINS`, `max_results`), returning `[{"title","url","content"}]`. Network errors → `[]` (never raise).

- [ ] **Step 1 (test):** provider `none` → `[]` without HTTP; provider `tavily` with mocked httpx → parsed results; HTTP error → `[]`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(chat): pluggable web-search provider`.

### Task C2: wire fallback into reply generation

**Files:**
- Modify: `backend/chat/services.py` (`retrieve_snippets` / `generate_reply` / `stream_reply`)
- Test: extend `backend/chat/tests/test_chat.py`

**Interfaces — Produces:** when merged retrieval yields nothing above `RETRIEVAL_MIN_SCORE` **and** provider configured, call `web_search`, wrap results as a "live search" reference block, generate normally; `sources_from_snippets` emits `{"type":"web","title","url"}`.

- [ ] **Step 1 (test):** with retrieval empty + provider mocked, reply includes `web` sources; with provider `none`, behavior unchanged (no web sources); web block passed to the model (assert in built messages).
- [ ] **Step 2:** run → fails.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** tests pass. Full suite green.
- [ ] **Step 5:** Commit `feat(chat): live web-search fallback`.

### Task C3: frontend "live search" badge

**Files:** Modify sources-chips component + i18n.
- [ ] **Step 1:** `web` type → external `url` + a localized "живой поиск / live" badge.
- [ ] **Step 2:** `npm run build` green.
- [ ] **Step 3:** Commit `feat(kb): live-search source badge`.

---

## Deploy / cutover runbook (user-gated — needs cloud secrets)

Executed after code is green + merged. Requires the user's Render `DATABASE_URL` and a Supabase go-ahead. The feature already works on the current Render Postgres (brute-force KB); this makes it fast at scale.

1. **Create Supabase project `govbot`** (free, region near users) via Supabase MCP; enable `vector` (`CREATE EXTENSION vector`). Capture the session-pooler `DATABASE_URL`.
2. **Preview + confirm**, then `pg_dump` current Render DB → `pg_restore`/`psql` into Supabase (preserves users/conversations).
3. **Repoint Render** `DATABASE_URL` → Supabase pooler. Redeploy. Verify auth + chat + scenarios live.
4. **Enable pgvector** on prod: run migration `0002` (adds `embedding_vec` + HNSW) + `reindex_kb --all` to backfill vectors.
5. **pg_cron job** in Supabase SQL:
   ```sql
   select cron.schedule('kb-tick','*/2 * * * *', $$
     select net.http_post(
       url:='https://govbot-backend-3utu.onrender.com/api/internal/kb/tick/',
       headers:=jsonb_build_object('X-KB-Tick-Secret', '<KB_TICK_SECRET>'));
   $$);
   ```
6. **Set env** on Render: `KB_TICK_SECRET` (random), optionally `KB_SEARCH_PROVIDER=tavily` + `TAVILY_API_KEY`.
7. **Verify live:** add one URL + one PDF source in admin → within a few ticks `status=indexed`; ask a question covered by them → answer cites a `kb` source; ask an uncovered question → (if Tavily set) live-search answer with `web` badge.
8. Keep Render Postgres until Supabase verified (rollback = repoint back). *(закрыто 2026-07: Supabase — единственная БД, Render Postgres выведен)*

---

## Self-Review

- **Spec coverage:** models §4 → A2; parsers/SSRF/chunking/embedding §5 → A3–A6; worker-less reindex §5.4 → A6–A7 + runbook 5; admin §5.5 → A8; pgvector shadow §4.2 → A9 + runbook 4; retrieval merge §6.1 → B1; citation `type` §6.2 → B2–B3; live fallback §7 → C1–C3; env §8 → A6/A7/C1; testing §9 → per-task tests; rollout §10 → phase order + runbook. Covered.
- **Placeholder scan:** none — each task names files, interfaces, and concrete test assertions.
- **Type consistency:** `run_kb_tick(limit)`, `index_source(source)->int`, `fetch_url(url)->(ct,body)`, `web_search(query,language)->list[dict]`, snippet `origin`, source `type` used consistently across tasks.
