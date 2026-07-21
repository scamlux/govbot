# GovBot — Admin-Managed Knowledge Base + Hybrid RAG (Design Spec)

- **Date:** 2026-07-21
- **Status:** Approved for implementation (design), pending user spec review
- **Author:** Claude (with user)
- **Supersedes / extends:** the existing scenario-only RAG in `backend/chat/retrieval.py`

---

## 1. Goal

Let an admin build a **Knowledge Base (KB)** from arbitrary sources — **web links, uploaded
documents (PDF / DOCX / TXT / Markdown), and pasted text** — entirely from the Django admin.
GovBot's AI then grounds its answers in that KB (real RAG), on top of the existing Scenario
Catalog. When neither the KB nor the catalog covers a question, a **live web-search fallback**
retrieves fresh material so the assistant can still answer (hybrid RAG).

The whole thing must run on **free infrastructure** and preserve the existing SQLite dev/test
fallback.

**Non-goals (this spec):**
- No re-write of the auth, chat, or scenario subsystems.
- No pgvector migration of `ScenarioEmbedding` (catalog stays brute-force — dozens of rows;
  revisit later).
- No paid workers, paid cron, or paid search tiers.
- No admin SPA — KB management lives in Django admin.

---

## 2. Infrastructure decision (resolved)

**Prod DB moves to a new Supabase free project (`govbot`).** Verified on the user's existing
Supabase org: the free tier ships `vector` 0.8.2 (pgvector, ivfflat + hnsw) **and** `pg_cron`
1.6.4 + `pg_net`. This single move resolves three constraints at once:

| Constraint | Resolution on Supabase free |
|---|---|
| pgvector for thousands+ chunks | `vector` 0.8.2 with HNSW index |
| Free scheduled reindex without a worker / GitHub Actions | `pg_cron` + `pg_net` call a secret-guarded tick endpoint |
| Render free Postgres deleted ~90 days after creation | Supabase Postgres is persistent |

**Migration approach:** create the `govbot` Supabase project, `pg_dump` the current Render
Postgres and restore into Supabase (preserve existing users/conversations — not a fresh start),
then repoint Render's `DATABASE_URL` env var at the Supabase session-pooler connection string.
The Render web service stays (native container for SSE streaming); only the database backend
changes. This is the one irreversible prod step — done under preview + explicit go-ahead, as a
Phase A task.

**Dev/test unchanged:** `conftest.py` still forces SQLite; docker-compose still offers local
Postgres. KB code must therefore work on **both** engines (see §5.3).

---

## 3. Architecture overview & phasing

Decomposed into three independently-shippable phases. **A + B deliver working KB-grounded RAG
without C.** C is the most independent and riskiest (external search reliability), so it ships
last and is opt-in (disabled until a key is set).

```
Phase A — Ingestion & storage
  admin adds source (url | file | paste)
        → parse-on-upload → text stored in Postgres (file discarded)
        → status: pending
  pg_cron (every ~2 min) → pg_net POST /internal/kb/tick/ (secret)
        → bounded slice: chunk → embed → store chunks (+pgvector shadow) → status: indexed
  also: `python manage.py reindex_kb` (Render Shell) + admin "reindex" action

Phase B — Retrieval merge
  retrieve(query) → [scenario hits (brute-force)] ⊕ [KB hits (pgvector ANN)]
        → normalize + merge + top-K → inject into prompt (existing grounding path)
        → sources[] gains a `type` discriminator (scenario | kb)

Phase C — Live fallback (opt-in)
  if merged best score < MIN_SCORE and KB_SEARCH_PROVIDER set:
        Tavily search (scoped to gov.uz/uz) → fetch+clean → inject → generate
        → sources[] tagged type=web ("живой поиск" badge)
```

---

## 4. Data model (Phase A)

New app: **`knowledge`** (`backend/knowledge/`). Keeping KB separate from `scenarios` keeps
each app single-purpose; retrieval merges them at query time.

### 4.1 `KnowledgeSource`
One admin-added source of truth.

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `source_type` | Char choices | `url` \| `pdf` \| `docx` \| `txt` \| `md` \| `paste` |
| `title` | Char | admin label; auto-filled from URL `<title>` / filename when blank |
| `url` | URLField, blank | for `url` type; also the citation `source_url` |
| `original_filename` | Char, blank | for uploads (provenance only; file not persisted) |
| `raw_text` | TextField, blank | **extracted text, stored at upload** (file is ephemeral) |
| `language` | Char | `uz` \| `ru` \| `en` \| `auto` (default `auto`) |
| `status` | Char choices | `pending` \| `parsing` \| `indexing` \| `indexed` \| `failed` |
| `error` | TextField, blank | last failure detail |
| `chunk_count` | PositiveInt | denormalized, updated on index |
| `checksum` | Char, blank | sha256 of `raw_text`; skip re-embed when unchanged |
| `is_active` | Bool, default True | inactive sources excluded from retrieval |
| `created_at` / `updated_at` | DateTime | |

Upload does **not** keep a `FileField` on disk (Render free disk is ephemeral and the web dyno
sleeps). The view parses the uploaded file in-memory and writes only `raw_text`. A large single
document is still fully captured in `raw_text`; chunking/embedding happen later in bounded ticks.

### 4.2 `KnowledgeChunk`
One retrievable, embedded slice of a source.

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `source` | FK → KnowledgeSource, CASCADE | |
| `order` | PositiveInt | position within source |
| `text` | TextField | chunk content |
| `token_count` | PositiveInt | for budgeting |
| `embedding` | **JSONField** (list[float]) | canonical vector; SQLite-friendly; brute-force fallback reads this |
| `model` | Char, blank | embedding model used |
| `updated_at` | DateTime | |

**Prod pgvector shadow (Postgres only):** a companion column `embedding_vec vector(1536)` plus an
HNSW index, added by a **guarded `RunSQL` migration** that no-ops on SQLite (vendor check). It is
written alongside `embedding` during indexing (raw `UPDATE ... = %s::vector`) and read by the
prod ANN query. Django's ORM only knows the JSONField; the vector column is managed via raw SQL
in the retrieval + indexing layer. This mirrors the documented intent on `ScenarioEmbedding`
("swap in pgvector once thousands") without breaking the SQLite test path.

---

## 5. Phase A — ingestion pipeline

### 5.1 Parsers (`knowledge/parsers.py`)
One function per input, each returning clean UTF-8 text:

- **URL** → `httpx` GET (guarded, §5.2) → `trafilatura.extract` (main-article text, drops
  nav/boilerplate). Fallback to a minimal tag-strip if extraction yields nothing.
- **PDF** → `pypdf` page-text concatenation.
- **DOCX** → `python-docx` paragraph text.
- **TXT / MD** → decode as-is (markdown kept; it embeds/reads fine as text).
- **paste** → stored verbatim.

New deps: `httpx`, `trafilatura`, `pypdf`, `python-docx`, `pgvector`. (Tavily in Phase C is
called over `httpx` — no extra SDK.)

### 5.2 SSRF guard (`knowledge/fetch.py`) — hard requirement (0-vuln gate)
Admin-supplied URLs are fetched server-side → classic SSRF surface. Guard **before every fetch,
and re-checked on each redirect hop**:

- scheme ∈ {http, https} only;
- resolve host → reject if any resolved IP is private / loopback / link-local / reserved
  (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, unspecified, multicast);
- connect timeout + read timeout (`KB_FETCH_TIMEOUT`, default 15s);
- cap response size (`KB_FETCH_MAX_BYTES`, default 5 MB) — stream and abort past the cap;
- accept only `text/html`, `text/plain`, `application/pdf` content types;
- redirects followed manually (max 3), each hop re-validated.

### 5.3 Chunking & embedding (`knowledge/indexing.py`)
- **Chunk:** ~`KB_CHUNK_TOKENS` (default 800) tokens with `KB_CHUNK_OVERLAP` (default 100)
  overlap, split on paragraph/sentence boundaries. Token counting via the existing OpenAI
  tokenizer if available, else a whitespace≈token heuristic (kept dependency-light).
- **Embed:** reuse `chat.retrieval.embed_texts` (OpenAI `text-embedding-3-small`, 1536-dim),
  batched (`KB_EMBED_BATCH`, default 64). In mock mode (no `OPENAI_API_KEY`) embeddings are
  skipped and retrieval falls back to keyword overlap — so dev/tests need no key, consistent
  with the current design.
- **Store:** write `KnowledgeChunk` rows; on Postgres also populate `embedding_vec`; set
  `chunk_count`, `checksum`, `status=indexed`, `last_indexed_at`.

### 5.4 Worker-less reindex pipeline
Three entry points, one bounded worker function `run_kb_tick(limit)`:

1. **`pg_cron` (prod default):** a scheduled job (every ~2 min) runs SQL that calls
   `net.http_post('<backend>/internal/kb/tick/', headers => secret)`. The endpoint is
   **secret-guarded** (`KB_TICK_SECRET` header) and does **bounded work per call**
   (`KB_TICK_BATCH` sources, default 1): pick the oldest `pending`/stale source, parse if
   needed, chunk, embed, store, mark `indexed`. Bounded work keeps each request short (no long
   sync request, safe under dyno sleep). Over successive ticks the backlog drains. This also
   doubles as a keep-alive.
2. **Management command `reindex_kb [--source <id>] [--all]`:** for Render Shell / local; same
   `run_kb_tick` logic, unbounded or targeted. Used for backfills.
3. **Admin action "Reindex selected":** flags sources `pending` (picked up by the next tick) or
   runs a single small source inline.

> Note on "free cron": Render cron is paid and GitHub Actions is billing-locked, so the trigger
> is deliberately `pg_cron` inside Supabase (free, always-on), not either of those.

### 5.5 Admin UX (`knowledge/admin.py`)
`KnowledgeSource` admin:
- add via URL, file upload, or pasted text (one form; `source_type` drives which field);
- list shows `title`, `source_type`, `status`, `chunk_count`, `language`, `updated_at`;
- filters by `source_type` / `status` / `is_active`; search on `title` / `url`;
- `error` shown read-only; "Reindex selected" and "Deactivate" actions;
- `KnowledgeChunk` as a **read-only inline** (text preview + order) for debugging.

---

## 6. Phase B — retrieval merge & citations

### 6.1 Merged retrieval (`chat/retrieval.py`)
Extend the existing `retrieve(query, language, k)`:
- keep scenario ranking as-is (brute-force cosine / keyword — few rows);
- add KB ranking: **pgvector ANN** (`ORDER BY embedding_vec <=> query LIMIT k`) on Postgres;
  **brute-force cosine over `embedding` JSON** on SQLite (dev/tests); **keyword overlap** in
  mock mode;
- **normalize** both score scales to [0,1], merge, dedupe, take global top-K
  (`RETRIEVAL_TOP_K`), drop below `RETRIEVAL_MIN_SCORE`.
- Snippet dicts gain `origin` (`scenario` | `kb`) so downstream can build the right citation.

### 6.2 Citation shape (fixes chip mismatch)
Existing chips link to `/scenarios/{slug}` — a KB chunk has no slug. `sources[]` items gain a
**`type` discriminator**; `chat.services.sources_from_snippets` emits it and it is persisted in
`Message.sources`:

```jsonc
// scenario (existing shape stays valid; missing type ⇒ "scenario" for back-compat)
{ "type": "scenario", "slug": "passport-renewal", "title": "…", "source_url": "https://…" }
// KB source (no internal route — links out only)
{ "type": "kb", "title": "Tax code excerpt", "source_url": "https://soliq.uz/…" }
// live web (Phase C)
{ "type": "web", "title": "…", "url": "https://…gov.uz/…" }
```

Frontend chip rendering (`components/…` sources chips): `scenario` → internal `/scenarios/{slug}`
+ external `source_url`; `kb` → external `source_url` only; `web` → external `url` + a "живой
поиск" badge. Old persisted rows (no `type`) render as `scenario` — backward compatible.

---

## 7. Phase C — live web-search fallback (opt-in)

Triggered only when merged retrieval finds nothing above `RETRIEVAL_MIN_SCORE` **and**
`KB_SEARCH_PROVIDER` is configured (default `none` ⇒ feature off, app unaffected).

- **Provider:** pluggable via `KB_SEARCH_PROVIDER`. Default target **Tavily** (free tier
  ~1000/mo, purpose-built for LLM RAG, reliable from cloud IPs — DDG frequently blocks datacenter
  IPs, so it is not the default). Called over `httpx` with `TAVILY_API_KEY`.
- **Scope:** `include_domains` from `KB_SEARCH_DOMAINS` (default `gov.uz,uz`) to keep results
  official; `KB_SEARCH_MAX_RESULTS` (default 3).
- **Flow:** search → take top results' extracted content (Tavily returns clean content;
  otherwise fetch top 1–2 via the §5.2 guarded fetcher) → inject as an "official reference
  (live search)" block using the existing `_format_reference` mechanism → generate with the
  existing OpenAI model → tag sources `type=web`. The system prompt already instructs citing
  sources and admitting uncertainty; the live block reuses it.
- **Cost:** search = free tier; generation = existing OpenAI key. $0 incremental. Grok/Claude
  native-search can be added later as alternate providers behind the same interface (paid — out
  of scope now).

---

## 8. Configuration (env vars)

Added to `backend/.env.example`, root `.env.example`, and documented in CLAUDE.md §6:

| Var | Default | Purpose |
|---|---|---|
| `KB_CHUNK_TOKENS` | 800 | chunk size |
| `KB_CHUNK_OVERLAP` | 100 | chunk overlap |
| `KB_EMBED_BATCH` | 64 | chunks per embedding call |
| `KB_TICK_BATCH` | 1 | sources processed per tick |
| `KB_TICK_SECRET` | — | shared secret for `pg_cron` → tick endpoint |
| `KB_FETCH_TIMEOUT` | 15 | URL fetch timeout (s) |
| `KB_FETCH_MAX_BYTES` | 5242880 | URL fetch size cap |
| `KB_MAX_FILE_MB` | 20 | upload size cap |
| `KB_SEARCH_PROVIDER` | `none` | `none` \| `tavily` |
| `TAVILY_API_KEY` | — | Phase C search key |
| `KB_SEARCH_DOMAINS` | `gov.uz,uz` | live-search domain scope |
| `KB_SEARCH_MAX_RESULTS` | 3 | live-search results |

`RETRIEVAL_TOP_K` / `RETRIEVAL_MIN_SCORE` (existing) now govern the merged scenario+KB set.

---

## 9. Testing strategy

All must pass on the forced-SQLite test DB (`conftest.py`) with OpenAI in mock mode.

- **Parsers:** small fixture PDF/DOCX/TXT/MD → expected text; URL parser with a mocked `httpx`
  response.
- **SSRF guard:** private/loopback/link-local hosts rejected; oversize + bad content-type
  rejected; redirect-to-internal rejected.
- **Chunking:** deterministic boundaries + overlap; token budget respected.
- **Indexing / tick:** `run_kb_tick` moves a source `pending → indexed`, creates chunks
  (embeddings mocked), is bounded by `KB_TICK_BATCH`, and is idempotent by `checksum`.
- **Tick endpoint:** rejects missing/wrong `KB_TICK_SECRET`; accepts valid.
- **Retrieval merge:** scenario + KB hits ranked together; brute-force branch exercised on
  SQLite; `origin`/`type` propagated; below-threshold dropped.
- **Citations:** `sources[]` carries correct `type`; legacy rows default to `scenario`.
- **Fallback (Phase C):** disabled when `KB_SEARCH_PROVIDER=none`; when enabled + retrieval
  empty, provider (mocked) is called and sources tagged `web`.
- The pgvector ANN SQL path is verified in prod / an optional Postgres-marked test; the ranking
  math is unit-tested as a pure function independent of engine.

---

## 10. Rollout order

**Phase A**
1. Create Supabase `govbot` project; enable `vector`; note pooler `DATABASE_URL`.
2. `pg_dump` Render → restore into Supabase (preview + explicit go-ahead before the switch).
3. Repoint Render `DATABASE_URL`; verify auth + chat + scenarios live.
4. `knowledge` app: models + migrations (incl. guarded pgvector shadow + HNSW).
5. Parsers + SSRF fetch + chunking + indexing + `run_kb_tick`.
6. Tick endpoint (secret) + `reindex_kb` command + admin.
7. `pg_cron` job in Supabase calling the tick endpoint.
8. Tests green; deploy; index a couple of real sources; confirm chunks in prod.

**Phase B**
9. Merge KB into `retrieve()`; `type` discriminator through services + `Message.sources`.
10. Frontend chip rendering for `kb`. Tests; deploy; confirm a KB-grounded answer cites a KB
    source.

**Phase C**
11. Pluggable search provider + Tavily; fallback wiring; `web` sources + badge. Tests; deploy;
    confirm an uncovered question answers via live search, disabled cleanly when unconfigured.

Each phase: build locally green (pytest + type-check) → commit small → deploy → verify the live
critical flow before calling it done (per CLAUDE.md "готово" = verified end-to-end).

---

## 11. Risks & tradeoffs

- **DB migration is the one irreversible step** — mitigated by dump/restore (data preserved) and
  a preview + explicit go-ahead before repointing `DATABASE_URL`. Rollback = repoint back to
  Render Postgres (kept until Supabase is verified).
- **Bounded ticks mean indexing is not instant** — a large backlog drains over minutes, not
  seconds. Acceptable on free infra; a paid worker would make it one-click-instant later.
- **pgvector shadow column adds a small dual-write** — contained in the indexing/retrieval layer;
  the JSON column stays canonical so dev/tests are unaffected.
- **Live search reliability** — isolated in Phase C, opt-in, provider-pluggable; Tavily chosen
  over DDG for datacenter-IP reliability.
- **Embedding cost** — `text-embedding-3-small` is ~$0.02/1M tokens; thousands of chunks ≈
  pennies, one-time per source. Negligible, but not literally $0 (uses the existing OpenAI key).
```
