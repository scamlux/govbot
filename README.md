# GovBot 🇺🇿

> **Government Information Made Simple Through AI.**

GovBot is a multilingual (Uzbek · Russian · English) AI-powered web app that gives
citizens, foreign residents, and tourists in Uzbekistan plain-language answers to
government-related questions — public services, legal procedures, administrative
requirements, regulations — through natural conversation, without forcing them to navigate
multiple official sites.

Two ways to get answers:

1. **AI chat** — a conversational assistant (OpenAI) answering free-form questions.
2. **Scenario Catalog** — curated, predefined answers for common topics (passport renewal,
   business registration, taxation, healthcare, visas, transport rules, residence
   registration, …).

---

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, React Router, react-i18next, axios |
| Backend  | Python 3.12, Django 5, Django REST Framework, SimpleJWT |
| Auth     | Email + password → app-issued JWT |
| AI       | OpenAI Chat Completions (mockable) |
| Database | PostgreSQL 16 |
| Deploy   | Docker + Docker Compose |

See [`CLAUDE.md`](CLAUDE.md) for the full architecture spec.

---

## Quick start (Docker — recommended)

```bash
cp .env.example .env          # then edit values (see "Configuration" below)
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:8000/api
- Django admin → http://localhost:8000/admin

The backend container runs migrations and seeds the Scenario Catalog automatically on
startup. To create an admin user:

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Local development (without Docker)

### Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # DATABASE_URL defaults to local sqlite if unset
python manage.py migrate
python manage.py seed_scenarios
python manage.py runserver     # http://localhost:8000
```

> Without `DATABASE_URL` / `POSTGRES_*` set, the backend falls back to a local SQLite
> database so you can run it instantly. Set the Postgres vars for a production-like setup.

### Frontend

```bash
cd frontend
cp .env.example .env           # set VITE_API_BASE_URL
npm install
npm run dev                    # http://localhost:5173
```

---

## Configuration

All secrets live in `.env` files (git-ignored). Templates are committed as `.env.example`.

### Authentication

GovBot uses **email + password** accounts. Register at `/register` (or via
`POST /api/auth/register/`); the response includes JWT access/refresh tokens and signs you
in automatically. There is no third-party provider to configure. Passwords are hashed with
Django's PBKDF2 and validated for minimum length.

### OpenAI

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4o-mini`).
**Leave the key blank to run in mock mode** — the chat works end-to-end with a clearly
labelled canned response, so you can develop the UI without spending tokens.

### Security & limits

- **SECRET_KEY (production):** with `DEBUG=0` the backend **refuses to start** on the
  insecure development default — always set a strong, unique `SECRET_KEY`.
- **Chat rate limits:** per-user `CHAT_THROTTLE_BURST` (default `20/min`) and
  `CHAT_THROTTLE_SUSTAINED` (default `500/day`) protect the OpenAI budget; a 429 returns a
  localized message. `CHAT_MAX_MESSAGE_CHARS` (default `4000`) caps message length.
- **Retrieval tuning:** `RETRIEVAL_TOP_K` and `RETRIEVAL_MIN_SCORE` tune RAG grounding.

### PWA / offline

The frontend is installable and caches the app shell + Scenario Catalog via a service
worker, so the catalog stays readable offline (chat still needs a connection). The chat box
also supports voice dictation (where the browser exposes the Web Speech API) and Markdown
export of a conversation.

---

## API overview

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register/` | public | Create account → JWT + user |
| POST | `/api/auth/login/` | public | Email + password → JWT + user |
| POST | `/api/auth/refresh/` | public | Refresh access token |
| GET/PATCH | `/api/auth/me/` | JWT | Current user profile |
| GET/POST | `/api/conversations/` | JWT | List / create conversations |
| GET/DELETE | `/api/conversations/{id}/` | JWT | Retrieve / delete a conversation |
| POST | `/api/conversations/{id}/messages/` | JWT | Send a message, get AI reply (JSON) |
| POST | `/api/conversations/{id}/messages/stream/` | JWT | Send a message, stream reply (SSE) |
| GET | `/api/scenarios/categories/` | public | List categories |
| GET | `/api/scenarios/` | public | List/search scenarios |
| GET | `/api/scenarios/{slug}/` | public | Scenario detail |

Add `?lang=uz|ru|en` to scenario endpoints to localize content.

---

## Production deployment

Runs entirely on **managed platforms — no VPS**:

- **Frontend → Vercel** (project `govbot-web`). `git push` to `main` auto-builds the Vite
  SPA. Set `VITE_API_BASE_URL` (the Render backend URL) in the Vercel project env.
- **Backend → Render** via the `render.yaml` Blueprint: a Django web service `govbot-backend`
  plus a managed Postgres `govbot-db` (its `DATABASE_URL` is injected automatically). `git push`
  auto-deploys. Set `SECRET_KEY`, `OPENAI_API_KEY`, `FRONTEND_ORIGIN` in the Render dashboard.
- **Keep-alive → UptimeRobot**: ping `/api/scenarios/categories/` every ~5 min so the Render
  free tier doesn't sleep (otherwise the next request pays a 30–60s cold start).

One-click: import this repo on **Render** (Blueprint reads `render.yaml`) and on **Vercel**
(frontend root). See `DEPLOY.md` for the full walkthrough.

Live: frontend **https://govbot-web.vercel.app** · backend **https://govbot-backend-3utu.onrender.com**

### CI

`.github/workflows` runs the backend test suite (`pytest`) on push/PR. The deploy itself is
handled by the Vercel/Render git integrations (no server-side scripts).

## Tests

```bash
cd backend
pytest
```

Covers: register/login flow (password auth), message creation (mocked OpenAI), scenario
list/filter.

---

## Project layout

```
umar/
├── CLAUDE.md            # full spec — source of truth
├── docker-compose.yml
├── backend/             # Django + DRF
└── frontend/            # React + Vite
```

## License

Graduation project — for educational use.
# muhammadumar
