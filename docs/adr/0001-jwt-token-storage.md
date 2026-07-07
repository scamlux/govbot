# ADR 0001 — JWT token storage

- **Status:** Accepted (decision recorded; implementation staged — see "Decision")
- **Date:** 2026-07-08
- **Backlog:** S2 (Epic S — security hardening)
- **Deciders:** GovBot engineering

## Context

GovBot authenticates with app-issued JWTs (SimpleJWT): a short-lived **access** token and a
longer-lived **refresh** token. Current behaviour (`frontend/src/api/client.js`,
`backend/config/settings.py`):

- Both access **and** refresh tokens are stored in **`localStorage`**.
- Access lifetime 60 min, refresh lifetime 7 days, `ROTATE_REFRESH_TOKENS = True`.
- The axios interceptor reads the access token from `localStorage`, attaches
  `Authorization: Bearer …`, and on a 401 uses the stored refresh token to get a new pair.

The security concern: **anything in `localStorage` is readable by any JavaScript running on
the origin.** A single successful XSS (e.g. via a compromised dependency or an unescaped
render path) can exfiltrate both tokens, and the refresh token grants 7 days of silent
re-authentication. For a government-information assistant whose conversations are personal
data, that is a meaningful exposure even though the tokens grant no financial or
irreversible actions.

## Options considered

1. **Status quo — both tokens in `localStorage`.**
   - + Simplest; survives reload; no CSRF surface; works across subdomains/CORS as-is.
   - − Full token theft on any XSS; refresh token especially valuable (7-day silent access).

2. **Refresh token in an `httpOnly; Secure; SameSite=Strict` cookie; access token in memory.**
   - + Refresh token is unreadable by JS → XSS can't exfiltrate long-lived credentials.
     Access token in memory dies on reload/tab-close, limiting its blast radius.
   - − Refresh endpoint must read/set cookies; needs **CSRF protection** on the
     cookie-authenticated refresh call; axios must send `withCredentials`; access token is
     lost on reload so the app must silently refresh on boot; CORS must allow credentials.
     Touches the refresh contract, `AuthContext`, and the interceptor app-wide.

3. **Both tokens in memory only.**
   - + No persistent exposure at all.
   - − User is logged out on every reload — unacceptable UX for a public assistant.

## Decision

**Adopt option 2 (refresh in `httpOnly` cookie, access in memory) as the target design, but
stage it: this ADR records the decision; the migration ships in its own security PR, not in
M2.**

Rationale for staging:

- The change is not additive — it alters the refresh endpoint's request/response contract,
  introduces CSRF handling, and rewrites the axios interceptor + `AuthContext` boot flow.
  Folding a cross-cutting auth refactor into the five-item M2 phase would risk destabilising
  working login/refresh with weak isolation. A dedicated PR can carry focused tests for the
  new flow (the S2 acceptance requires those tests only *if* adopting cookies).
- The current access-token lifetime (60 min) and refresh rotation already limit damage
  somewhat; the residual risk is the refresh token's `localStorage` exposure, which the
  staged work removes.

### What we do now (cheap, low-risk hardening, no contract change)

- Confirm tokens never appear in URLs/query strings (they don't — `Authorization` header only).
- Keep `ROTATE_REFRESH_TOKENS = True` and the short access lifetime.
- Treat a strict **Content-Security-Policy** as the highest-leverage defence-in-depth against
  the XSS that would make token theft possible; tracked as follow-up.

### Migration plan (the dedicated security PR)

1. Backend: issue the refresh token as an `httpOnly; Secure; SameSite=Strict` cookie on
   login/register/refresh; read it from the cookie on `/api/auth/refresh/`; stop returning it
   in the JSON body. Add CSRF protection (double-submit token or DRF's CSRF enforcement) on
   the cookie-authenticated refresh endpoint.
2. Frontend: hold the access token in memory (module/`AuthContext` state, not `localStorage`);
   set axios `withCredentials: true`; on app boot, call refresh once to rehydrate the access
   token; drop refresh-token `localStorage` usage.
3. CORS: `CORS_ALLOW_CREDENTIALS = True` and an explicit `FRONTEND_ORIGIN` allowlist.
4. Tests: login sets the cookie; refresh works from the cookie without a body token; a
   request without the cookie fails; CSRF is enforced on refresh.

## Consequences

- **Now:** no code change to auth; the risk is documented and accepted for M2, with the
  remediation path defined. S2's ADR-acceptance is met.
- **After the migration:** XSS can no longer steal the long-lived refresh token; access-token
  exposure is bounded to its in-memory lifetime. Cost: added CSRF surface and a slightly more
  complex boot/refresh flow, both covered by tests.
