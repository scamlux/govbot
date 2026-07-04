# Deploying GovBot (Path A: Railway backend + Vercel frontend)

This is the cloud deploy that keeps the app exactly as architected — native Django on
gunicorn (so **SSE streaming chat keeps working**), managed Postgres, and the Vite SPA on
Vercel's CDN.

```
  ┌─────────────┐        https        ┌──────────────────────┐
  │   Vercel    │  ── API calls ──▶   │       Railway        │
  │  Vite SPA   │                     │  Django + gunicorn   │
  │  (static)   │  ◀── SSE stream ──  │  + Postgres plugin   │
  └─────────────┘                     └──────────────────────┘
```

Order matters: **deploy the backend first** so you know its URL before building the
frontend (the SPA bakes `VITE_API_BASE_URL` in at build time).

The backend can go on **Render** (recommended — one-click Blueprint, no API token) or
**Railway**. Pick one for section 1, then do Vercel in section 2.

---

## 1a. Backend + Postgres on Render (recommended — Blueprint)

The repo ships a `render.yaml` Blueprint, so Render provisions the web service **and** a
Postgres database in one step — no API token or CLI needed.

1. Create an account at [render.com](https://render.com) and connect your GitHub.
2. Dashboard → **New +** → **Blueprint** → select this repo → **Apply**.
   Render reads `render.yaml`: builds `backend/Dockerfile`, creates `govbot-db` (free
   Postgres), wires `DATABASE_URL`, and generates a strong `SECRET_KEY`.
3. On the `govbot-backend` service → **Environment**, set the two `sync: false` vars:
   - `OPENAI_API_KEY=sk-...` (omit → chat runs in mock mode)
   - `FRONTEND_ORIGIN=https://<your-vercel-app>.vercel.app` (fill after step 2 below)
4. The service auto-deploys. Entrypoint runs `migrate` + `seed_scenarios` +
   `collectstatic`; healthcheck hits `/api/scenarios/categories/`. Note the URL, e.g.
   `https://govbot-backend.onrender.com`.
5. (If a real key was set) build vector embeddings once: service → **Shell** →
   `python manage.py embed_scenarios`.

`RENDER_EXTERNAL_HOSTNAME` is auto-trusted by settings for `ALLOWED_HOSTS`/CSRF — nothing
to wire by hand. Then skip to **section 2 (Vercel)**.

---

## 1b. Backend + Postgres on Railway (alternative)

1. Create a project at [railway.app](https://railway.app) → **New Project**.
2. **Add a Postgres**: New → Database → PostgreSQL. Railway exposes `DATABASE_URL`.
3. **Add the backend service**: New → GitHub Repo → this repo.
   - Settings → **Root Directory** = `backend` (so it builds `backend/Dockerfile`; the
     included `backend/railway.json` pins the Dockerfile builder + healthcheck).
4. **Variables** (Service → Variables). Reference the DB with Railway's `${{...}}` refs:

   ```
   SECRET_KEY=<run: python -c "import secrets;print(secrets.token_urlsafe(50))">
   DEBUG=0
   ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   FRONTEND_ORIGIN=https://<your-vercel-app>.vercel.app
   OPENAI_API_KEY=sk-...                # omit → chat runs in mock mode (canned replies)
   OPENAI_MODEL=gpt-4o-mini
   ```

   `RAILWAY_PUBLIC_DOMAIN` is auto-injected and auto-trusted by settings for both
   `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` — no manual host wiring needed.
5. Deploy. The container entrypoint runs `migrate`, `seed_scenarios`, and `collectstatic`
   automatically; healthcheck hits `/api/scenarios/categories/`.
6. Settings → Networking → **Generate Domain**. Note the URL, e.g.
   `https://govbot-backend.up.railway.app`.
7. (If a real `OPENAI_API_KEY` was set) build embeddings once for vector RAG:
   Railway service → **Shell** → `python manage.py embed_scenarios`.
   Without a key, grounding uses keyword retrieval — still works.

## 2. Frontend on Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import this repo.
2. **Root Directory** = `frontend`. Framework auto-detects as Vite (config in
   `frontend/vercel.json`: SPA rewrites + asset caching).
3. **Environment Variable**:

   ```
   VITE_API_BASE_URL=https://govbot-backend.up.railway.app/api
   ```

4. Deploy. Copy the resulting `https://<app>.vercel.app` URL.

## 3. Wire the two together

- Set the backend's `FRONTEND_ORIGIN` (Railway) to the exact Vercel URL from step 2 so CORS
  (and the SSE stream) allow it. Redeploy the backend if you changed it after the fact.
- Open the Vercel URL → register → send a chat message. A grounded question (e.g. *"How do I
  renew my passport?"*) should stream a reply and show source chips.

---

## Smoke test (curl)

```bash
API=https://govbot-backend.up.railway.app/api
# public catalog (no auth)
curl -s $API/scenarios/categories/ | head
# register + grounded chat
TOK=$(curl -s -X POST $API/auth/register/ -H 'content-type: application/json' \
  -d '{"email":"demo@ex.com","password":"Str0ng!pass123","full_name":"Demo"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access"])')
CID=$(curl -s -X POST $API/conversations/ -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -d '{"language":"en"}' | python -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST $API/conversations/$CID/messages/ -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -d '{"content":"How do I renew my passport?","language":"en"}' | python -m json.tool
```

## Cost note
Both platforms have usable free/hobby tiers for a demo. Railway's Postgres + a small service
and Vercel's hobby plan cover this app. A real `OPENAI_API_KEY` is the only paid dependency
— and it's optional (mock mode keeps the app fully navigable without one).
