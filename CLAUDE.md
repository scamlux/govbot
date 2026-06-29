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
- Google Identity Services for sign-in

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
│   ├── accounts/                  # Google OAuth + JWT, custom User
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
        ├── auth/                  # Google sign-in, auth context, protected routes
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
  optional `tokens` (int, nullable), `model` (char, nullable).

**`scenarios.Category`**:
- `slug` (unique), `icon` (emoji/icon name string), `name` (JSON: `{uz,ru,en}`),
  `description` (JSON: `{uz,ru,en}`), `order` (int).

**`scenarios.Scenario`**:
- `category` (FK), `slug` (unique), `title` (JSON: `{uz,ru,en}`),
  `body` (JSON: `{uz,ru,en}`, markdown-capable), `tags` (JSON list), `order` (int),
  `is_published` (bool, default True), `updated_at`.

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
  user message, calls the OpenAI service, persists and returns the assistant reply.
  **Streaming:** implemented via Server-Sent Events at
  `POST /api/conversations/{id}/messages/stream/` (chunked `text/event-stream`).
  The non-streaming endpoint above returns the full reply as JSON.

**Scenarios** (public read; admin write via Django admin)
- `GET /api/scenarios/categories/?lang=uz`
- `GET /api/scenarios/?category={slug}&lang=ru&search=...`
- `GET /api/scenarios/{slug}/?lang=en`

### 4.3 OpenAI service (`chat/services.py`)
- `generate_reply(messages, language)` builds the request and calls the OpenAI Chat
  Completions API. A streaming variant `stream_reply(messages, language)` yields chunks.
- Reads `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_MAX_TOKENS`
  (default 1200) and `OPENAI_TEMPERATURE` (default 0.3) from env.
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

### 4.4 Settings
- CORS for `http://localhost:5173` (Vite) and `FRONTEND_ORIGIN` env var (production).
- DRF default auth = JWT; default permission = `IsAuthenticated`, except scenario read
  endpoints which are `AllowAny`.
- DB from `DATABASE_URL` (or discrete `POSTGRES_*` vars) — works locally and in Docker.
  When neither is set, a local SQLite file (`db.sqlite3`) is used so the backend runs
  instantly in development. Tests force this SQLite fallback via `conftest.py`.
- All models registered in Django admin.
- Seed command `python manage.py seed_scenarios` populates the catalog with realistic,
  clearly-marked sample entries in all three languages.

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

---

## 6. Environment variables

**Backend** (`backend/.env.example`): `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`,
`DATABASE_URL` (or `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST`
/ `POSTGRES_PORT`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`,
`OPENAI_TEMPERATURE`, `FRONTEND_ORIGIN`, `ACCESS_TOKEN_LIFETIME_MIN`,
`REFRESH_TOKEN_LIFETIME_DAYS`.

**Frontend** (`frontend/.env.example`): `VITE_API_BASE_URL`.

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
- Tests (pytest + pytest-django): Google auth flow (mocked Google token), message creation
  (mocked OpenAI), scenario list/filter.

---

## 9. Build order (sequential; status update after each phase)
1. `CLAUDE.md`, `.gitignore`, root `README.md` skeleton, `.env.example`.
2. Django project + apps (`config`, `accounts`, `chat`, `scenarios`), custom user model,
   settings wired to env, PostgreSQL, CORS, DRF, SimpleJWT. `migrate` succeeds.
3. Google OAuth → JWT auth (`accounts`) + `/auth/me`.
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
