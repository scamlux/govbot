# ADR 0001 — JWT token storage: localStorage vs httpOnly refresh cookie

- **Status:** Accepted (keep current approach; revisit before public launch)
- **Date:** 2026-07-03
- **Backlog:** Epic S — Security hardening, task **S2**

## Context

GovBot authenticates with app-issued JWTs (`djangorestframework-simplejwt`): a short-lived
access token and a longer-lived refresh token. Today both are stored in the browser's
`localStorage` (`frontend/src/api/client.js`), attached to requests by an axios interceptor,
and rotated on a 401 via `/api/auth/refresh/`.

Two storage models were considered:

1. **Current — both tokens in `localStorage`.**
   - + Simple; works across tabs; survives reload; no CSRF surface (tokens are sent via an
     `Authorization` header, not automatically by the browser).
   - − Readable by any JavaScript running on the page, so a successful **XSS** can exfiltrate
     both tokens and impersonate the user until the refresh token expires.

2. **Refresh token in an `httpOnly; Secure; SameSite` cookie; access token in memory only.**
   - + The refresh token is invisible to JavaScript, so XSS cannot steal long-lived
     credentials; the in-memory access token dies on reload/tab-close.
   - − Requires backend changes (set/clear cookie on login/refresh/logout, read refresh from
     the cookie), **CSRF protection** on the cookie-authenticated refresh endpoint, correct
     cross-site cookie attributes for the split frontend/backend origins, and reworking the
     axios flow to hold the access token in memory. More moving parts to get exactly right.

## Decision

**Keep tokens in `localStorage` for now.** The migration to an httpOnly refresh cookie is
the right long-term direction but is deferred until closer to a public launch, and must be
done as its own change (with CSRF handling and tests) rather than bundled into the Epic A/S
quick wins.

The primary risk of the current model is XSS, so the pragmatic near-term mitigations are to
**shrink the XSS attack surface** rather than move the token:

- Keep access-token lifetime short (`ACCESS_TOKEN_LIFETIME_MIN`, default 60) and rely on
  refresh rotation (`ROTATE_REFRESH_TOKENS = True`, already enabled).
- Continue rendering assistant/scenario content through React + `react-markdown` (no
  `dangerouslySetInnerHTML`), which escapes by default.
- Add a Content-Security-Policy at the nginx/edge layer before public launch.

## Consequences

- No code change ships with this ADR; the current flow stands.
- When adopting cookies (follow-up to S2): refresh token → `httpOnly; Secure; SameSite=Strict`
  cookie, access token → memory, axios interceptor updated, CSRF token handled on the refresh
  call, and tests for the new flow. Track as a dedicated task.
