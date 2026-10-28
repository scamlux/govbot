# CLAUDE.md — GovBot

This file is the **single source of truth** for the GovBot project. Every change must stay
consistent with this spec. If the implementation deviates, update this file to match.

---

## 1. Project goal

**GovBot** is a multilingual, AI-powered web application that gives citizens, foreign
residents, and tourists in Uzbekistan plain-language answers to government-related
questions (public services, legal procedures, administrative requirements, regulations)
through natural conversation — without forcing them to navigate multiple official sites.

**Tagline:** _"Government Information Made Simple Through AI."_

Two ways users get answers:

1. **AI chat** — a conversational assistant powered by an LLM (OpenAI API) that answers
   free-form questions in natural language.
2. **Scenario Catalog** — curated, predefined answers for frequently requested topics
   (passport renewal, business registration, taxation, healthcare services, visa
   requirements, vehicle/transport rules, residence registration, etc.).

**Languages:** Uzbek (Latin) `uz`, Russian `ru`, English `en`. The entire product — UI,
AI responses, and scenario content — works in all three. The AI answers in the language
the user writes in (or the language they selected). Default UI language: `uz`.

---

## 2. Technology stack (exact)

### Frontend
- React 18 + Vite
- React Router (routing)
- React Context + hooks for state (no Redux)
- `react-i18next` for UI strings (uz / ru / en)
- Plain modern CSS / CSS modules — clean, accessible, responsive, mobile-first
- `axios` for API calls, with a JWT interceptor (attach access token, refresh on 401)
- Email + password forms → app-issued JWT

### Backend
- Python 3.12, Django 5.x, Django REST Framework
- PostgreSQL 16 via Django ORM (`psycopg`)
- Auth: **email + password** sign-in/registration → app-issued **JWT**
  (`djangorestframework-simplejwt`). Passwords hashed with Django's PBKDF2; validated with
  Django's password validators. Email is the username field.
- OpenAI integration via the official `openai` Python SDK
- `django-cors-headers` for the Vite dev origin + production origin
- `django-environ` for config from environment
- `whitenoise` to serve Django admin static files under gunicorn (no nginx in front of
  the backend container)

### Database
- PostgreSQL 16

### Deployment
- Docker + Docker Compose; Git / GitHub
- Dockerfiles for backend and frontend + root `docker-compose.yml`
  (services: `db`, `backend`, `frontend`)
- Frontend production build served via nginx

---

## 3. Repository structure

```
umar/                              # repo root (the GovBot project)
├── CLAUDE.md
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── manage.py
│   ├── .env.example
│   ├── pytest.ini / conftest.py
│   ├── config/                    # Django project: settings, urls, wsgi/asgi
│   ├── accounts/                  # email+password auth + JWT, custom User
│   ├── chat/                      # conversations, messages, OpenAI service
│   └── scenarios/                 # Scenario Catalog: categories + multilingual entries
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── api/                   # axios client + endpoint helpers
        ├── auth/                  # login/register forms, auth context, protected routes
        ├── components/            # ChatWindow, MessageBubble, LanguageSwitcher, etc.
        ├── pages/                 # Landing, Chat, ScenarioCatalog, ScenarioDetail, Login
        ├── i18n/                  # locales: uz.json, ru.json, en.json + config
        └── styles/
```

---

## 4. Backend specification

### 4.1 Data model

**`accounts.User`** (custom user model; `AUTH_USER_MODEL = "accounts.User"`):
- `email` (unique, used as username field), `full_name`, `avatar_url` (optional),
  `preferred_language` (`uz`/`ru`/`en`, default `uz`), `created_at`, plus the hashed
  `password` from `AbstractBaseUser`.
- `USERNAME_FIELD = "email"`, no `username` field.

**`chat.Conversation`**:
- `user` (FK), `title` (auto-generated from first message), `language`, `created_at`,
  `updated_at`.

**`chat.Message`**:
- `conversation` (FK), `role` (`user` / `assistant`), `content` (text), `created_at`,
  optional `tokens` (int, nullable), `model` (char, nullable), `sources` (JSON list,
  nullable — RAG citations `[{slug,title,source_url}]` persisted on a grounded assistant
  reply so reopened conversations still show them).

**`chat.MessageFeedback`** (answer quality signal):
- `message` (OneToOne → assistant Message), `rating` (`up`/`down`), `reason` (text, optional),
  `created_at`, `updated_at`. One row per message; re-rating upserts.

**`scenarios.Category`**:
- `slug` (unique), `icon` (emoji/icon name string), `name` (JSON: `{uz,ru,en}`),
  `description` (JSON: `{uz,ru,en}`), `order` (int).

**`scenarios.Scenario`**:
- `category` (FK), `slug` (unique), `title` (JSON: `{uz,ru,en}`),
  `body` (JSON: `{uz,ru,en}`, markdown-capable), `source_url` (URL, optional — official
  agency link surfaced when the AI cites this scenario), `tags` (JSON list), `order` (int),
  `is_published` (bool, default True), `updated_at`.
  2026-10 additions (migration `0004`, additive): `status` (`draft`/`review`/`published`,
  kept in sync with `is_published` — `set_status()` drives visibility), `verified_at`
  (date, nullable — A3), `checklist` (JSON `{uz,ru,en: [str]}` — C1, editor-filled only),
  `audience` (JSON list of `citizen`/`resident`/`tourist`; empty = everyone — B3).

**`scenarios.ScenarioRevision`** (E2): `scenario` (FK), `data` (JSON snapshot of the
editable fields), `author_email`, `note`, `created_at`. One row is written before every
admin update and before a restore, so restores are undoable.

**`scenarios.ScenarioEmbedding`** (RAG grounding store):
- `scenario` (FK), `language` (`uz`/`ru`/`en`), `vector` (JSON list of floats), `model`,
  `updated_at`; unique per (`scenario`, `language`). Vectors are stored as plain JSON (not
  pgvector) and ranked by brute-force cosine in Python — chosen for KISS at catalog scale
  and to keep the SQLite dev fallback working. Swap in pgvector once the catalog reaches
  thousands of rows.

> Convention: multilingual fields are stored as JSON objects keyed by language code
> (`{"uz": "...", "ru": "...", "en": "..."}`). Serializers resolve a single language via a
> `?lang=` query param, falling back uz → en → ru → first available.

### 4.2 API endpoints (DRF, under `/api/`)

**Auth**
- `POST /api/auth/register/` — body `{ email, password, full_name?, preferred_language? }`.
  Create the account, return `{ access, refresh, user }` (auto sign-in).
- `POST /api/auth/login/` — body `{ email, password }`. Return `{ access, refresh, user }`.
- `POST /api/auth/refresh/` — SimpleJWT refresh.
- `GET  /api/auth/me/` — current user profile (auth required).
- `PATCH /api/auth/me/` — update `preferred_language`, `full_name`.

**Chat** (auth required)
- `GET    /api/conversations/` — list current user's conversations (no messages).
- `POST   /api/conversations/` — create a conversation.
- `GET    /api/conversations/{id}/` — conversation with its messages.
- `DELETE /api/conversations/{id}/`.
- `POST   /api/conversations/{id}/messages/` — body `{ content, language }`. Persists the
  user message, calls the OpenAI service, persists and returns the assistant reply. Response
  includes `sources: [{slug,title,source_url}]` (B1) — the RAG grounding citations, empty
  when ungrounded. **Rate limited** per user (A1): a burst (`CHAT_THROTTLE_BURST`, default
  20/min) and a sustained (`CHAT_THROTTLE_SUSTAINED`, default 500/day) throttle; a 429
  returns a localized message. `content` is length-capped server-side by
  `CHAT_MAX_MESSAGE_CHARS` (default 4000) with a localized 400 (S3).
  **Streaming:** implemented via Server-Sent Events at
  `POST /api/conversations/{id}/messages/stream/` (chunked `text/event-stream`); it emits an
  `event: sources` frame before `event: done`. Both endpoints are throttled identically.
  The non-streaming endpoint above returns the full reply as JSON.
- `POST   /api/messages/{id}/feedback/` — body `{ rating: up|down, reason? }` (A2). Owner-only,
  assistant messages only, idempotent upsert.

**Scenarios** (public read; admin write via Django admin)
- `GET /api/scenarios/categories/?lang=uz`
- `GET /api/scenarios/?category={slug}&lang=ru&search=...`
- `GET /api/scenarios/{slug}/?lang=en`

**Admin — chat oversight** (staff only)
- `GET /api/admin/feedback/?rating=down` — paginated feedback list, newest first, with the
  rated message content + conversation language (A3).
- `GET /api/admin/analytics/questions/?days=30` — top question terms, message/conversation
  counts, and a per-language split over the window (C1).
- `GET /api/admin/analytics/gaps/?days=30` — frequent questions whose reply retrieved no
  grounding, clustered and ranked by frequency = missing scenarios (C2). Paraphrases are
  merged (A8): embedding cosine in vector mode, stemmed-term Jaccard otherwise; each gap
  carries `variants`.

**Upgrades 2026-10** (full checklist: `docs/research/upgrade-plan.md`)
- `POST /api/auth/logout/` `{refresh}` — revokes the refresh token (F2; SimpleJWT
  `token_blacklist`, `BLACKLIST_AFTER_ROTATION=True`). Always 205.
- **Cookie auth (F1):** with the opt-in request header `X-Auth-Cookie: 1`, login/register/
  refresh/logout keep the refresh token in the httpOnly cookie `govbot_refresh` (HttpOnly,
  `Secure` unless `DEBUG`, `SameSite=Lax`, `Path=/api/auth/`) instead of the JSON body;
  refresh/logout read it from the cookie. The frontend keeps the access token in memory
  only, migrates a legacy localStorage token once, and uses Web Locks to serialise refresh
  across tabs. CORS credentials are disabled (same-origin); `x-auth-cookie` is an allowed
  header.
- **Same-origin API:** the frontend always calls `/api` (`VITE_API_BASE_URL=/api`, set in
  Vercel Production). Vercel rewrites `/api/(.*)` → `https://govbot-backend-3utu.onrender.com/api/$1`
  (regex, so trailing-slash URLs match) with rewrite caching OFF
  (`x-vercel-enable-rewrite-caching: 0`, `Cache-Control: no-store`); locally the Vite dev
  proxy does it, in compose nginx does. SSE streams incrementally through the proxy.
- `POST /api/auth/me/delete/` `{password}` — self-delete account + conversations (F3);
  the last active staff account cannot delete itself.
- `GET /api/auth/me/export/` — JSON download of profile, conversations, messages, feedback (F3).
- `GET /api/config/` — public, non-secret flags: `guest_chat`, `chat_mode`, `ai_mode`
  (`live`/`mock`/`catalog_only`), `telegram_bot`.
- `POST /api/chat/guest/stream/` `{content, language, plain?, history[]}` — stateless guest
  SSE turn (B1). 404 unless `GUEST_CHAT_ENABLED`; IP-throttled (`GUEST_THROTTLE_*`); nothing
  persisted. `/api/chat/related/` is also open to guests only while guest chat is enabled.
- `POST /api/telegram/webhook/` — Telegram bot (D1). 404 unless `TELEGRAM_BOT_TOKEN`; 403
  without the `X-Telegram-Bot-Api-Secret-Token`; stateless; throttled per chat id.
- Message endpoints accept `plain: true` (R5 simple language) and return/emit the reply
  `language` (A7 — detected from the question when confident).
- `GET /api/scenarios/?audience=citizen|resident|tourist` — role filter (B3); search folds
  Uzbek apostrophes ʻ ʼ ‘ ’ to `'` (R4).
- Admin: `/api/admin/scenarios/?status=`, `…/{id}/revisions/`, `…/{id}/revisions/{rid}/restore/`
  (E2), `/api/admin/scenarios/stale/` (E4), `/api/admin/kb/sources/` CRUD + `…/{id}/reindex/` (E3).

### 4.3 OpenAI service (`chat/services.py`)
- `generate_reply(messages, language)` builds the request and calls the OpenAI Chat
  Completions API. A streaming variant `stream_reply(messages, language)` yields chunks.
- Reads `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_EMBEDDING_MODEL`
  (default `text-embedding-3-small`), `OPENAI_MAX_TOKENS` (default 1200) and
  `OPENAI_TEMPERATURE` (default 0.3) from env.
- **RAG grounding (`chat/retrieval.py`):** before each reply, the latest user question is
  matched against the Scenario Catalog and the most relevant scenarios are injected into the
  prompt as an "official reference material" block, with a localized instruction to prefer
  that material, cite the `source_url`, and admit uncertainty (pointing to the official
  body) when the material doesn't cover the question. Two modes, chosen automatically:
  **vector** (embed the query, cosine-rank `ScenarioEmbedding` rows) when a key is set;
  **keyword** (term overlap on scenario text) as fallback in mock mode or before embeddings
  are built — so grounding is demonstrable in local dev without a key. Embeddings are
  refreshed on scenario save via a `post_save` signal and can be backfilled with
  `python manage.py embed_scenarios`.
- **System prompt** that:
  - defines GovBot as an assistant for Uzbekistan government / public-service information,
  - instructs replying in the user's language (`uz`/`ru`/`en`),
  - is concise, factual, and clearly states when information may be outdated or should be
    verified with the official agency,
  - never invents specific legal article numbers, fees, or deadlines it isn't sure about;
    instead points to the responsible official body.
- Includes recent conversation history (last N=10 messages) for context.
- Handles API errors gracefully → friendly localized error message.
- **Mockable:** if `OPENAI_API_KEY` is unset, returns a clear localized canned reply so the
  app runs in development without a key.
- **Trust & safety (2026-10):**
  - A6 — when retrieval finds nothing, an explicit "no verified material" system message
    tells the model to say so and avoid specific fees/deadlines/articles.
  - A5 — the system prompt asks one clarifying question when the answer depends on the
    user's status (citizen / resident / tourist).
  - F5 — `chat/safety.mask_pii` masks passport, PINFL, phone, card and email in the query
    (before embedding) and in the history sent to OpenAI. Stored messages are unchanged.
  - F6 — retrieved catalog/KB/web text is sanitised (`sanitize_reference`) and wrapped in
    one `<reference>` block with a "data, not instructions" guard; red-team cases live in
    `tests/test_safety.py`.
  - E5 — `CHAT_MODE=catalog_only` never calls the LLM; replies list matching scenarios.
- **Retrieval quality (A4):** keyword mode matches 5-letter stems with extra weight for
  title hits. `python manage.py eval_retrieval [--sweep] [--show-misses]` measures
  recall@k on the golden set in `chat/eval_golden.py` (keyword mode: 55% → 86% on 29 cases).
- **Ops commands:** `purge_conversations` (F4, uses `CONVERSATION_RETENTION_DAYS`),
  `check_scenario_links` (E4, exits non-zero on broken source links),
  `apply_content_updates` (runs every deploy; idempotent; writes a `ScenarioRevision` first
  and never overwrites editor changes — sets official `source_url`s and document checklists;
  `verified_at` stays empty until the owner checks), `createcachetable` (entrypoint; backs
  the shared `DatabaseCache` so throttles hold across gunicorn workers and restarts).

### 4.4 Settings
- CORS for `http://localhost:5173` (Vite) and `FRONTEND_ORIGIN` env var (production).
- DRF default auth = JWT; default permission = `IsAuthenticated`, except scenario read
  endpoints which are `AllowAny`.
- DB from `DATABASE_URL` (or discrete `POSTGRES_*` vars) — works locally and in Docker.
  When neither is set, a local SQLite file (`db.sqlite3`) is used so the backend runs
  instantly in development. Tests force this SQLite fallback via `conftest.py`.
- All models registered in Django admin (incl. read-only `MessageFeedback`).
- Seed command `python manage.py seed_scenarios` populates the catalog with realistic,
  clearly-marked sample entries in all three languages. It runs on every deploy, so it only
  creates missing scenarios and fills empty fields — it never overwrites existing ones
  (status, editor edits). `--reset` overwrites them (local dev only).
- **SECRET_KEY guard (S1):** with `DEBUG=False` the app refuses to start on the insecure
  default key (`config.settings.require_secure_secret_key`, skipped only under pytest).
- **Chat throttles (A1):** `DEFAULT_THROTTLE_RATES` scopes `chat_burst` / `chat_sustained`,
  read from `CHAT_THROTTLE_BURST` / `CHAT_THROTTLE_SUSTAINED`; applied on the message +
  stream views only.
- **Tunables:** `CHAT_MAX_MESSAGE_CHARS` (S3), `RETRIEVAL_TOP_K` / `RETRIEVAL_MIN_SCORE`
  (B4) are all env-configurable.

---

## 5. Frontend specification

### 5.1 Pages & routing
- `/` **Landing** — value prop, tagline, language switcher, CTA into chat, preview of
  scenario categories.
- `/login` — email + password sign-in form. On success → store JWT, redirect. Links to
  `/register`.
- `/register` — full name + email + password form. Creates the account and auto-signs in.
- `/chat` (protected) — sidebar (conversation list + "new chat"), message area with
  user/assistant bubbles, input box, language indicator, loading/typing state, streaming
  assistant response.
- `/scenarios` — Scenario Catalog: category grid, search box, language-aware.
- `/scenarios/:slug` — scenario detail rendered from markdown, with an "Ask the AI about
  this" button that opens chat pre-filled.

### 5.2 Auth & i18n
- Auth context: `user`, `login`, `logout`, token handling. Axios interceptor attaches the
  access token and refreshes on 401.
- `react-i18next` with `uz.json`, `ru.json`, `en.json` for all UI strings.
- Persistent `LanguageSwitcher` — choice persisted to localStorage and to the user profile
  when logged in. Default `uz`.
- Selected UI language is sent as the `language` field to chat/scenario endpoints.

### 5.3 UX/design
- Clean, modern, trustworthy "civic" feel — friendly, not bureaucratic. Responsive
  (mobile-first), accessible (labels, focus states, keyboard nav). Light theme.

### 5.4 Post-MVP features
- **Sources chips (B2):** grounded assistant answers render clickable source chips linking to
  `/scenarios/{slug}` and the external `source_url` (new tab, `rel="noopener"`).
- **Answer feedback (A2):** 👍/👎 under each assistant bubble; 👎 opens an optional reason
  field. State persists (returned on conversation reload).
- **Admin Analytics tab (C3):** top question terms, language split, catalog gaps, recent 👎,
  with a date-range selector.
- **PWA (D1):** web manifest + service worker (`frontend/public/`). App shell + Scenario
  Catalog cached (stale-while-revalidate) for offline reading; offline banner.
- **Voice input (D2):** Web Speech API mic button in the chat box; hidden when unsupported.
- **Export (D3):** download the active conversation as Markdown (incl. sources), client-side.

### 5.5 Upgrades 2026-10 (see `docs/research/upgrade-plan.md`)
- **Trust layer:** disclaimer under the chat input + one-time 3-step onboarding
  (`components/AiNotice.jsx`); source chips show their origin (catalog / knowledge base /
  web); an "ungrounded" note on unsupported answers; official hotlines 112 / 1173 / 1242
  (verified on my.gov.uz/ru/for-foreigners) in the footer and after a 👎.
- **Scenario detail:** breadcrumbs, official source link, "verified on" badge
  (`verified_at`), documents checklist with local progress (C1/C2), `.ics` reminder on a
  user-chosen date (C4), sticky "Ask the AI".
- **Landing:** search box, role picker (citizen / resident / tourist) driving "popular
  situations" via `?audience=`; guest CTA when guest chat is on.
- **Chat:** guest mode (`<Chat guest />`, nothing stored), stop button (AbortController),
  "simple language" toggle, read-aloud (Web Speech TTS, only when a voice exists for the
  language), "answered in …" note when the reply language differs from the UI.
- **Embeddable widget (D2):** `<script src="https://<site>/widget.js" data-lang="ru" async>`
  adds a floating button that opens `/embed` (guest chat, no site chrome) in an iframe.
  Always guest, even for signed-in visitors. Only `/embed` may be framed by other sites
  (`frame-ancestors *`); every other route sends `frame-ancestors 'self'` / `SAMEORIGIN`.
- **Global:** Ctrl/⌘+K search palette (`CommandPalette.jsx`), footer, skip link,
  `/privacy` (draft pending legal review), `ConfirmDialog` replacing `window.confirm`,
  accessible `Modal` (portal, focus trap, focus return), XL font size, Save-Data lite mode.
- **Admin:** side navigation + Overview (KPIs, stale scenarios, top gaps), scenario status
  workflow, revision history/restore, verified date, audience, checklist editor, Knowledge
  base tab.
- **Accessibility tokens** live in `styles/upgrades.css` (imported after `global.css`):
  every text/control token passes WCAG AA (contrast verified by formula). Uzbek okina ʻ
  falls back to a 2-glyph Noto Sans subset because Golos Text / Manrope lack U+02BB.

---

## 6. Environment variables

**Backend** (`backend/.env.example`): `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`,
`DATABASE_URL` (or `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST`
/ `POSTGRES_PORT`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`,
`OPENAI_MAX_TOKENS`, `OPENAI_TEMPERATURE`, `FRONTEND_ORIGIN`, `ACCESS_TOKEN_LIFETIME_MIN`,
`REFRESH_TOKEN_LIFETIME_DAYS`, `CHAT_THROTTLE_BURST`, `CHAT_THROTTLE_SUSTAINED`,
`CHAT_MAX_MESSAGE_CHARS`, `RETRIEVAL_TOP_K`, `RETRIEVAL_MIN_SCORE`,
`KB_CHUNK_TOKENS`, `KB_CHUNK_OVERLAP`, `KB_EMBED_BATCH`, `KB_TICK_BATCH`, `KB_TICK_SECRET`,
`KB_FETCH_TIMEOUT`, `KB_FETCH_MAX_BYTES`, `KB_MAX_FILE_MB`, `KB_SEARCH_PROVIDER`,
`TAVILY_API_KEY`, `KB_SEARCH_DOMAINS`, `KB_SEARCH_MAX_RESULTS`, `CHAT_MODE`,
`GUEST_CHAT_ENABLED`, `GUEST_THROTTLE_BURST` (3/min), `GUEST_THROTTLE_SUSTAINED` (10/day),
`GUEST_THROTTLE_GLOBAL` (300/day, one cap for all guests), `GUEST_THROTTLE_RELATED`
(10/min), `NUM_PROXIES` (optional, unset),
`CHAT_AUTODETECT_LANGUAGE`, `CONVERSATION_RETENTION_DAYS`, `ADMIN_CAN_READ_CONVERSATIONS`,
`SCENARIO_STALE_DAYS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_THROTTLE`.

**Frontend** (`frontend/.env.example`): `VITE_API_BASE_URL` (`/api` in production — same-origin).

Root `.env.example` aggregates the values docker-compose needs. Nothing sensitive is ever
hardcoded or committed — only `.env.example` templates are committed; real `.env` is
git-ignored.

---

## 7. Docker
- `backend/Dockerfile` — Python 3.12 slim, install requirements, run migrations, start
  gunicorn (dev compose may use `runserver`).
- `frontend/Dockerfile` — multi-stage: Node build → nginx serves the static build.
- Root `docker-compose.yml` — `db` (postgres:16, named volume), `backend` (depends on db,
  migrates on start, seeds, exposes 8000), `frontend` (nginx, exposes 80→5173). Uses env
  files. `docker compose up` brings up a working stack.

---

## 8. Quality bar
- Backend: clear DRF serializers/viewsets, proper status codes, input validation, no N+1
  on conversation/message lists (use `select_related`/`prefetch_related`).
- Frontend: no console errors, loading + empty states, graceful API/auth failure handling.
- Tests (pytest + pytest-django): email+password auth flow (register/login/refresh), message creation
  (mocked OpenAI), scenario list/filter.

---

## 9. Build order (sequential; status update after each phase)
1. `CLAUDE.md`, `.gitignore`, root `README.md` skeleton, `.env.example`.
2. Django project + apps (`config`, `accounts`, `chat`, `scenarios`), custom user model,
   settings wired to env, PostgreSQL, CORS, DRF, SimpleJWT. `migrate` succeeds.
3. Email+password → JWT auth (`accounts`) + `/auth/me`.
4. `scenarios` models, admin, serializers, public endpoints, multilingual seed command.
5. `chat` models, OpenAI service (mockable), chat endpoints (streaming via SSE).
6. Backend tests; confirm everything runs.
7. Vite + React frontend: routing, auth context, axios client, i18n with 3 locales.
8. Login, Landing, Chat, Scenario Catalog, Scenario Detail pages.
9. Dockerfiles + `docker-compose.yml`; verify `docker compose up`. Finalize `README.md`.

---

## 10. Conventions
- Python: 4-space indent, type hints where helpful, Django app-local `urls.py` included
  into `config/urls.py` under `/api/`.
- JS: functional components, hooks, named exports for helpers, default export for page/
  component modules. ES modules.
- Commit secrets never. Document every env var in `.env.example`.
- Language fallback order everywhere: requested → uz → en → ru → first available.
