# GovBot — Product Requirements Document (PRD)

**Status:** Living document · **Owner:** Product/Eng · **Last updated:** 2026-07-06
**Related docs:** [`CLAUDE.md`](CLAUDE.md) (technical spec — *how*) ·
[`BACKLOG.md`](BACKLOG.md) (task breakdown — *when*). This PRD is the *why / what*; it does
not repeat the data model or endpoint list — those live in `CLAUDE.md`.

---

## 1. Vision

Government information in Uzbekistan is scattered across dozens of agency sites, mostly in
one language, and written for bureaucrats rather than people. GovBot collapses that into a
single conversation: **ask a question in your language, get a clear, source-grounded
answer.**

- **Near-term (this project):** a trustworthy multilingual assistant that answers
  government / public-service questions by grounding every answer in a curated, citable
  Scenario Catalog — so it is useful *and* safe to rely on.
- **Long-term:** the default first stop for citizens, residents, and tourists dealing with
  the state — expanding coverage, learning from real demand, and integrating official data
  sources over time.

**Value proposition:** _Government Information Made Simple Through AI._

**North-star metric:** share of sessions that end in a *grounded, positively-rated* answer
(see §8).

---

## 2. Problem & why now

| Problem | Who feels it | Today's workaround |
|---|---|---|
| Info spread across many agency sites | All users | Google, forums, asking friends |
| Language barrier (much content RU/UZ only) | Tourists, foreign residents | Machine translation of whole sites |
| Bureaucratic, procedure-heavy language | Citizens | Calling / visiting offices |
| No single "ask a question" entry point | All users | Trial and error |

LLMs now make natural-language answering viable in three languages at once — but a raw LLM
**hallucinates fees, deadlines, and legal article numbers**, which for government info is
worse than no answer. GovBot's bet: an LLM *grounded* in curated official content is the
right shape for this problem.

---

## 3. Target users & personas

| Persona | Primary needs | Success looks like |
|---|---|---|
| **Citizen** | Public services: passports, taxes, licenses, healthcare, residence | Gets the steps + responsible agency without visiting an office |
| **Foreign resident** | Regulations, administrative procedures, registration | Understands obligations in EN/RU with links to act on |
| **Tourist** | Visas, arrival registration, transport, healthcare, legal basics | Fast answer on mobile, often offline / poor connectivity |
| **Content admin** *(internal)* | Curate scenarios & categories in 3 languages | Publishes/updates catalog; monitors answer quality |

Non-users we are **not** designing for: officials processing cases, developers needing raw
open-data APIs.

---

## 4. Goals & non-goals

**Goals**

- Answer government-related questions conversationally in **uz / ru / en**.
- **Ground** answers in the Scenario Catalog and cite the responsible body / source.
- Let users keep and revisit **conversation history**.
- Give admins a way to **curate multilingual content** and watch quality.
- Be **safe**: admit uncertainty instead of inventing specifics.

**Non-goals** (explicit, to keep scope honest)

- Not a **FAQ website** — the chatbot is the primary surface; the catalog serves it.
- Not a **BPM / workflow** engine — GovBot informs, it does not process applications.
- Not a **government service portal** — no payments, submissions, or account-of-record.
- Not legal advice — GovBot gives general information and points to the official body.

---

## 5. Current state (shipped)

A working MVP is deployed (frontend on Vercel; backend containerized with CI/CD). Verified
in-repo at time of writing:

- **Auth:** email + password → app-issued **JWT** (SimpleJWT), custom email-based user,
  protected + admin routes. *(Note: earlier concept named Google OAuth; the project pivoted
  to email+password for MVP simplicity — see §11 decision D1.)*
- **AI chat:** conversations + messages, **SSE streaming**, recent-history context,
  graceful error handling, and a **mock mode** that runs the whole app with no OpenAI key.
- **RAG grounding** *(Epic B core — new):* answers are grounded in the catalog via
  `ScenarioEmbedding` + `chat/retrieval.py` (vector mode with a key, keyword fallback
  without), injected as an "official reference material" block with a cite-the-source
  instruction. `source_url` on scenarios; `embed_scenarios` backfill command.
- **Scenario Catalog:** multilingual (`{uz,ru,en}`) categories + scenarios, public read with
  `?lang=` + search; **7 categories / 7 scenarios** seeded.
- **Admin:** in-app panel (users, categories, scenarios CRUD) + Django admin.
- **Quality:** **33** passing backend tests; Docker (dev + prod); GitHub Actions deploy.

**Scale:** ~2.4k LOC backend, ~2.6k LOC frontend, 6 models.

---

## 6. Functional requirements

Status legend: ✅ shipped · 🔧 partial · 🗓️ planned (see `BACKLOG.md` IDs).

### 6.1 AI chat  *(primary surface)*

| # | Requirement | Status |
|---|---|---|
| FR-C1 | User asks free-form questions; assistant replies in the user's language | ✅ |
| FR-C2 | Responses **stream** token-by-token | ✅ |
| FR-C3 | Assistant uses recent conversation history for context | ✅ |
| FR-C4 | System prompt forbids inventing fees/deadlines/article numbers; points to official body when unsure | ✅ |
| FR-C5 | Runs without an API key (mock mode) for dev/demo | ✅ |
| FR-C6 | Per-user **rate limiting** to protect budget/availability | ✅ A1 |
| FR-C7 | Server-side **max message length** validation | ✅ S3 |

### 6.2 RAG grounding

| # | Requirement | Status |
|---|---|---|
| FR-R1 | Retrieve most relevant scenarios for each question (vector or keyword) | ✅ |
| FR-R2 | Inject reference material + instruction to prefer it and cite `source_url` | ✅ |
| FR-R3 | Refresh embeddings on scenario save; backfill command | ✅ |
| FR-R4 | Return **structured sources** to the client (API/SSE) | ✅ B1 |
| FR-R5 | Show **source chips** under grounded answers | ✅ B2 |
| FR-R6 | Persist sources on the message so history keeps citations | 🗓️ B3 |

### 6.3 Scenario Catalog  *(secondary surface)*

| # | Requirement | Status |
|---|---|---|
| FR-S1 | Browse categories and scenarios, language-aware | ✅ |
| FR-S2 | Search scenarios by title/body/tags in the selected language | ✅ |
| FR-S3 | Scenario detail renders markdown; "Ask the AI about this" opens chat pre-filled | ✅ |
| FR-S4 | Optional official `source_url` per scenario | ✅ |

### 6.4 Auth & history

| # | Requirement | Status |
|---|---|---|
| FR-A1 | Register / login / logout → JWT; refresh on 401 | ✅ |
| FR-A2 | Protected chat; users see only their own conversations | ✅ |
| FR-A3 | View, reopen, continue, delete conversations | ✅ |
| FR-A4 | Persist preferred language to profile | ✅ |

### 6.5 Admin & quality loop

| # | Requirement | Status |
|---|---|---|
| FR-M1 | CRUD categories & scenarios with multilingual fields | ✅ |
| FR-M2 | Manage users (staff view) | ✅ |
| FR-M3 | **Answer feedback** (👍/👎 + reason) captured per message | ✅ A2 |
| FR-M4 | Feedback + **question analytics** visible to admins | 🗓️ A3, C1, C3 |
| FR-M5 | **Catalog-gap** report (frequent questions with no grounding) | 🗓️ C2 |

### 6.6 Reach & accessibility

| # | Requirement | Status |
|---|---|---|
| FR-X1 | Full UI localization uz/ru/en with persistent switcher | ✅ |
| FR-X2 | Responsive, mobile-first, keyboard-accessible | ✅ |
| FR-X3 | **PWA + offline** catalog for poor connectivity | 🗓️ D1 |
| FR-X4 | **Voice input** for low-literacy / mobile users | 🗓️ D2 |
| FR-X5 | **Export** a conversation | 🗓️ D3 |

---

## 7. Non-functional requirements

- **Trust & safety:** never fabricate specifics; grounded answers cite a source; visible
  "verify with the official agency" disclaimer. This is the product's core promise.
- **Performance:** streamed first token target **p95 < 2.5 s**; catalog reads **p95 <
  300 ms**; no N+1 on conversation/message/scenario lists.
- **Security:** JWT auth, RBAC (staff-only admin), input validation, secrets only via env,
  HTTPS-ready. Enforce non-default `SECRET_KEY` in prod (S1); revisit token storage (S2).
- **Cost control:** rate limiting (A1); `gpt-4o-mini` + bounded `max_tokens`; embeddings
  computed once per scenario, cached.
- **Privacy:** conversations are personal data — store the minimum, scope strictly to the
  owner, and keep analytics aggregate (no per-user profiling beyond the account).
- **Reliability:** graceful OpenAI failure → localized friendly message; app fully
  functional in mock mode.
- **Maintainability:** clean layering (API / service / retrieval / data), `CLAUDE.md` kept
  as source of truth on every behavioral change.
- **i18n correctness:** consistent fallback order requested → uz → en → ru → first available.

---

## 8. Success metrics

Proposed targets (instrument via A2 feedback + C1 analytics; treat as hypotheses to tune):

| Metric | Definition | Target |
|---|---|---|
| **Grounding coverage** | % of gov questions where retrieval returns ≥1 source | ≥ 70% |
| **Answer satisfaction** | 👍 / (👍+👎) on assistant messages | ≥ 80% |
| **Catalog-gap closure** | Top ungrounded topics turned into scenarios / month | ≥ 5 |
| **First-token latency** | p95 stream start | < 2.5 s |
| **Repeat usage** | Users with ≥2 conversations in 30 days | Trend ↑ |
| **Language spread** | Sessions per uz/ru/en | Healthy in all three |

North-star = share of sessions ending in a grounded, positively-rated answer (combines
coverage × satisfaction).

---

## 9. Release plan

Milestones map to `BACKLOG.md`; each ends with tests + a `CLAUDE.md` update.

- **M1 — Trustworthy answers (P1):** A1 rate limiting · A2 feedback · B1/B2 sources in UI ·
  S1 secret-key guard (+S3 pulled forward). ✅ shipped — users see sources, rate answers,
  budget protected.
- **M2 — Operate & learn (P2):** A3 feedback in admin · C1/C3 analytics dashboard · B3
  persisted sources · S2/S3 security hardening. → admins monitor quality and demand.
- **M3 — Reach (P3):** C2 gap report · D1 PWA/offline · D2 voice · D3 export · B4 retrieval
  eval harness. → broader audience and self-improving catalog.

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Hallucinated specifics** (fees, deadlines, laws) | Erodes trust; real-world harm | RAG grounding + strict system prompt + visible disclaimer + feedback loop |
| **Stale catalog** vs changing regulations | Wrong-but-confident answers | `updated_at` surfacing, admin gap report (C2), "verify with agency" framing |
| **OpenAI cost / outage / rate limits** | Budget blowout or downtime | Rate limiting (A1), token caps, mock/keyword fallback, friendly errors |
| **Perceived as official / liability** | Legal exposure | Clear "informational, not official/legal advice" disclaimer; always name the responsible body |
| **Privacy of conversations** | User harm, compliance | Minimal storage, strict owner scoping, aggregate-only analytics |
| **Low catalog coverage at launch** | Weak grounding | Seed priority topics; C2 to prioritize expansion by real demand |

---

## 11. Key product decisions

- **D1 — Email+password over Google OAuth (MVP):** removes Google-project setup friction and
  works offline in dev. Google OAuth remains an optional future sign-in method, not a
  blocker. *(Reflected in code; `CLAUDE.md` is authoritative.)*
- **D2 — JSON vectors + brute-force cosine, not pgvector:** at catalog scale (tens–hundreds
  of rows) it's effectively free, keeps the SQLite dev fallback working, and defers a real
  vector index until the catalog reaches thousands of rows.
- **D3 — Grounding degrades gracefully:** keyword retrieval when no API key, so grounding is
  demonstrable without cost/network.

---

## 12. Open questions

- Do we need a **guest/anonymous** chat mode (esp. tourists) or is account-required
  acceptable for the diploma scope?
- Should scenario content have an **official review/approval** workflow before publish?
- What is the **canonical source** per topic (which agency site) for `source_url`?
- Retention policy for conversations — how long do we keep them?
- Is **Google OAuth** in scope for the graded deliverable, or explicitly future work?
