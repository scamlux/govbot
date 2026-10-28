"""F1 — httpOnly refresh-token cookie, opt-in per request.

Why opt-in: the SPA is served same-origin with the API through a Vercel ``/api`` rewrite,
so a first-party cookie works. Clients that are NOT same-origin (an old cached bundle
calling Render directly, local dev against another port) keep the legacy flow: the
refresh token travels in the JSON body and lives in localStorage. A client opts in by
sending ``X-Auth-Cookie: 1``; only then is the refresh token moved out of the body and
into the cookie.

Attributes (do not weaken):

* ``HttpOnly`` — JavaScript (and therefore XSS) can never read the token.
* ``SameSite=Lax`` — never ``None``. The browser will not attach the cookie to cross-site
  fetch/XHR/form POSTs, which is the CSRF defence for the cookie-authenticated refresh.
  As defence in depth the refresh endpoint also *requires* the opt-in header when the token
  comes from the cookie, so a plain cross-site form post cannot trigger it.
* ``Path=/api/auth/`` — the cookie is only sent to the auth endpoints.
* ``Secure`` — decided explicitly from ``DEBUG`` (not from ``request.is_secure()``, which
  depends on proxy headers and silently flips off if a hop drops ``X-Forwarded-Proto``).
"""
from django.conf import settings

OPT_IN_META = "HTTP_X_AUTH_COOKIE"


def wants_cookie(request) -> bool:
    return request.META.get(OPT_IN_META) == "1"


def _cookie_kwargs() -> dict:
    return {
        "path": settings.AUTH_REFRESH_COOKIE_PATH,
        "samesite": "Lax",
    }


def set_refresh_cookie(response, refresh_token) -> None:
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        str(refresh_token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        **_cookie_kwargs(),
    )


def clear_refresh_cookie(response) -> None:
    # Same path/samesite as when it was set, otherwise the browser keeps the old cookie.
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE_NAME, **_cookie_kwargs())


def refresh_from_cookie(request) -> str | None:
    return request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or None
