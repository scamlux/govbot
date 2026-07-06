# GovBot — Product Backlog

Post-MVP backlog. The MVP (auth, chat + SSE, Scenario Catalog, admin, Docker, CI) and
**Epic B core — RAG grounding** are already shipped. This document tracks what's next.

**How to read a task:** each has a size (**S** ≤0.5d · **M** ~1–2d · **L** ~3–5d), a
priority (P1 do-first · P2 · P3), acceptance criteria (the "done" bar), the files it
touches, and dependencies. IDs are stable — reference them in commits/PRs (e.g. `feat(A2):
message feedback`).

Suggested order: **A → B-finish → C → D**, with **S (security)** interleaved as noted.
Every task ends with tests + a `CLAUDE.md` update when behavior/spec changes.

---

## Epic A — Resilience & answer quality  *(P1)*

Protects the OpenAI budget and gives us a signal to measure answer quality. Highest
value-per-effort; ship first.

### A1 — Rate limiting on chat endpoints  ✅ *(S, P1)*
Throttle the message + stream endpoints so a single user can't burn the OpenAI budget or
DoS the service.

- **Acceptance (as shipped):** two per-user DRF throttle scopes on `MessageCreateView` and
  `MessageStreamView` — `chat_burst` 20/min + `chat_sustained` 500/day (a single
  `ScopedRateThrottle` scope can't hold two rates); anonymous blocked (already auth-only);
  429 returns a localized message; limits read from env with sane defaults.
- **Touches:** `config/settings.py` (`DEFAULT_THROTTLE_RATES`), `chat/views.py`,
  `backend/.env.example`, `tests/test_chat.py`.
- **Depends on:** —

### A2 — Answer feedback (👍 / 👎 + reason)  ✅ *(M, P1)*
Let users rate assistant replies. The only real signal for monitoring a government
assistant's accuracy over time.

- **Acceptance:** `chat.MessageFeedback` model (`message` FK unique, `rating` up/down,
  `reason` optional text, `created_at`); `POST /api/messages/{id}/feedback/` (auth, only the
  message's owner); idempotent upsert; thumbs render under each assistant bubble in
  `MessageBubble.jsx` with active state; 👎 opens an optional reason field.
- **Touches:** `chat/models.py`, `chat/serializers.py`, `chat/views.py`, `chat/urls.py`,
  migration, `frontend/src/components/MessageBubble.jsx`, `frontend/src/api/endpoints.js`,
  i18n locales, `tests/test_chat.py`, `CLAUDE.md`.
- **Depends on:** —

### A3 — Feedback visible in admin  *(S, P2)*
Surface ratings so admins can find weak answers.

- **Acceptance:** `MessageFeedback` registered in Django admin (list_filter by rating,
  read-only); admin API list endpoint `GET /api/admin/feedback/?rating=down` (staff only),
  paginated, newest first, includes message content + conversation language.
- **Touches:** `chat/admin.py`, `config/urls.py` or `chat/urls.py`, `chat/serializers.py`,
  `tests/test_admin_api.py`.
- **Depends on:** A2

---

## Epic B — RAG grounding: finish  *(P1)*

Core shipped. Remaining work makes the grounding *visible* and *tunable*.

### B1 — Return structured sources to the client  ✅ *(M, P1)*
Today the model cites `source_url` inline from the prompt; the retrieved snippets aren't
returned as data. Expose them so the UI can render trustworthy source chips.

- **Acceptance:** `retrieval.retrieve()` result attached to the assistant response —
  non-stream endpoint adds `sources: [{slug, title, source_url}]`; SSE emits an
  `event: sources` frame before `done`. No duplicate scenarios; empty list when ungrounded.
- **Touches:** `chat/views.py` (both views), `chat/services.py` (expose retrieved snippets
  without re-querying), `chat/serializers.py`, `tests/test_retrieval.py`, `CLAUDE.md`.
- **Depends on:** —

### B2 — Sources UI under assistant answers  ✅ *(S, P1)*
Render the sources from B1 as clickable chips (catalog link + official `source_url`).

- **Acceptance:** chips appear under grounded assistant messages (both streamed + loaded
  history if persisted); link to `/scenarios/{slug}` and, when present, the external
  `source_url` (new tab, `rel="noopener"`); hidden when no sources; localized "Sources:"
  label.
- **Touches:** `frontend/src/components/MessageBubble.jsx`, `Chat.jsx`, endpoints, i18n,
  `styles/global.css`.
- **Depends on:** B1

### B3 — Persist sources on the Message  *(S, P2)*
So reopened conversations still show citations (otherwise sources vanish on reload).

- **Acceptance:** nullable `sources` JSON on `chat.Message`, populated when the assistant
  reply is grounded; returned by the conversation-detail serializer; migration.
- **Touches:** `chat/models.py`, `chat/views.py`, `chat/serializers.py`, migration, tests.
- **Depends on:** B1

### B4 — Retrieval quality knobs + eval harness  *(M, P3)*
Make `TOP_K` / `MIN_SCORE` env-tunable and add a tiny offline eval to catch regressions.

- **Acceptance:** thresholds read from settings; a management command or pytest fixture runs
  a small labelled query→expected-scenario set and reports hit-rate for both keyword and
  (mocked) vector modes.
- **Touches:** `chat/retrieval.py`, `config/settings.py`, `tests/test_retrieval.py`.
- **Depends on:** —

---

## Epic C — Admin analytics  *(P2)*

Turn chat traffic into insight: what citizens ask most, and where the catalog has gaps.

### C1 — Question analytics API  *(M, P2)*
Aggregate what's being asked, by language and period.

- **Acceptance:** staff-only `GET /api/admin/analytics/questions/?days=30` returning top
  terms/topics, message + conversation counts, and split by language; efficient queries
  (aggregation, no N+1); no PII leakage beyond aggregates.
- **Touches:** `chat/` (new analytics view/service), `config/urls.py`,
  `tests/test_admin_api.py`.
- **Depends on:** —

### C2 — "Catalog gaps" report  *(M, P3)*
Find frequent questions that retrieved **no** grounding — these are missing scenarios.

- **Acceptance:** log per-message whether grounding was found (reuse B1 data); admin
  endpoint lists ungrounded query clusters ranked by frequency; each links to "create
  scenario" prefilled.
- **Touches:** `chat/models.py` (grounded flag) or reuse B3, analytics view, admin frontend.
- **Depends on:** B1, C1

### C3 — Analytics dashboard tab  *(M, P2)*
Visualize C1/C2 in the existing admin panel.

- **Acceptance:** new "Analytics" tab in `Admin.jsx`: top-questions table, language split,
  gaps list; loading/empty states; date-range selector; no console errors.
- **Touches:** `frontend/src/pages/Admin.jsx`, `api/endpoints.js`, i18n, styles.
- **Depends on:** C1 (C2 optional)

---

## Epic D — Reach & accessibility  *(P3)*

Broadens usefulness for tourists and citizens on poor connectivity / low literacy.

### D1 — PWA + offline Scenario Catalog  *(L, P3)*
Installable app; catalog readable offline (chat still needs network).

- **Acceptance:** web manifest + icons; service worker caches the app shell and scenario
  list/detail responses (stale-while-revalidate); offline banner; Lighthouse PWA pass.
- **Touches:** `frontend/` (manifest, SW, `vite.config.js` / plugin), `nginx.conf` headers.
- **Depends on:** —

### D2 — Voice input in chat  *(M, P3)*
Speech-to-text for the message box (Web Speech API) — helps low-literacy + mobile users.

- **Acceptance:** mic button in the input bar; dictation fills the textarea in the selected
  language; graceful hide when unsupported; accessible labels.
- **Touches:** `frontend/src/pages/Chat.jsx`, i18n, styles.
- **Depends on:** —

### D3 — Export conversation  *(S, P3)*
Download a conversation as Markdown/PDF.

- **Acceptance:** "Export" action on a conversation → Markdown file (client-side) incl.
  sources; optional server PDF endpoint later.
- **Touches:** `frontend/src/pages/Chat.jsx`, endpoints, i18n.
- **Depends on:** B1 (for sources in export)

---

## Epic S — Security hardening  *(cross-cutting, interleave)*

### S1 — Enforce non-default SECRET_KEY in production  ✅ *(S, P1)*
- **Acceptance:** startup fails (or loud warning) when `DEBUG=False` and `SECRET_KEY` is the
  insecure default; documented in `.env.example` / README.
- **Touches:** `config/settings.py`, `README.md`. **Do alongside A1.**

### S2 — Auth token storage review  *(M, P2)*
Decide JWT-in-localStorage (XSS exposure) vs httpOnly refresh cookie; document the tradeoff
as an ADR before changing.

- **Acceptance:** short ADR in repo; if adopting cookies: refresh token in httpOnly
  `Secure` `SameSite` cookie, access token in memory, axios interceptor updated, CSRF
  handled; tests for the new flow.
- **Touches:** `accounts/`, `frontend/src/auth/*`, `api/client.js`, settings, tests.
- **Depends on:** — (schedule after Epic A)

### S3 — Input hardening on chat  ✅ *(S, P2)*
- **Acceptance:** max message length enforced server-side (serializer) + client hint;
  reject oversized payloads with a localized 400.
- **Touches:** `chat/serializers.py`, `Chat.jsx`, tests. **Bundle with A1/A2.**

---

## Milestones

- **M1 — Trustworthy answers (P1):** A1, A2, B1, B2, S1 (+S3 pulled forward). ✅ shipped
  — users see sources, rate answers, budget protected.
- **M2 — Operate & learn (P2):** A3, C1, C3, B3, S2/S3. → admins monitor quality and demand.
- **M3 — Reach (P3):** C2, D1, D2, D3, B4.
