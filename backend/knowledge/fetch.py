"""SSRF-guarded server-side URL fetcher for Knowledge Base link sources.

Admin-supplied URLs are fetched by the server, which is a classic SSRF surface (an attacker
who can add a source could otherwise reach cloud metadata endpoints, internal services, or
localhost). Every request is validated before connecting, and every redirect hop is
re-validated:

* scheme must be http/https;
* the host must resolve exclusively to public IPs (no loopback / private / link-local /
  reserved / multicast / unspecified — this blocks 169.254.169.254, 127.0.0.1, 10.x, etc.);
* response size, timeout, and content-type are capped.
"""
import ipaddress
import logging
import socket
from urllib.parse import urljoin, urlparse

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_CONTENT_TYPES = {"text/html", "text/plain", "application/pdf"}
MAX_REDIRECTS = 3
_USER_AGENT = "GovBot-KnowledgeBase/1.0 (+https://govbot)"


class UnsafeURLError(Exception):
    """Raised when a URL fails the SSRF / safety checks (or the fetch itself fails)."""


def _fetch_timeout() -> float:
    return float(getattr(settings, "KB_FETCH_TIMEOUT", 15))


def _max_bytes() -> int:
    return int(getattr(settings, "KB_FETCH_MAX_BYTES", 5 * 1024 * 1024))


def is_public_host(host: str) -> bool:
    """True only if ``host`` resolves and every resolved IP is a routable public address."""
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    ips = {info[4][0] for info in infos}
    if not ips:
        return False
    for ip_str in ips:
        try:
            ip = ipaddress.ip_address(ip_str.split("%")[0])  # strip IPv6 zone id
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False
    return True


def _make_client() -> httpx.Client:
    """Build the HTTP client (indirection point so tests can inject a MockTransport)."""
    return httpx.Client(follow_redirects=False, timeout=_fetch_timeout())


def _guard(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"scheme not allowed: {parsed.scheme!r}")
    if not is_public_host(parsed.hostname):
        raise UnsafeURLError(f"host not allowed: {parsed.hostname!r}")


def fetch_url(url: str) -> tuple[str, bytes]:
    """Fetch ``url`` safely and return ``(content_type, body_bytes)``.

    Raises ``UnsafeURLError`` for a disallowed scheme/host, an oversize or wrong-typed
    response, too many redirects, or any transport error.
    """
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        _guard(current)
        try:
            with _make_client() as client:
                with client.stream(
                    "GET", current, headers={"User-Agent": _USER_AGENT}
                ) as resp:
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            raise UnsafeURLError("redirect without a location header")
                        current = urljoin(current, location)
                        continue
                    if resp.status_code >= 400:
                        raise UnsafeURLError(f"HTTP {resp.status_code}")
                    ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                    if ctype not in ALLOWED_CONTENT_TYPES:
                        raise UnsafeURLError(f"content-type not allowed: {ctype!r}")
                    limit = _max_bytes()
                    body = bytearray()
                    for chunk in resp.iter_bytes():
                        body += chunk
                        if len(body) > limit:
                            raise UnsafeURLError("response exceeds size limit")
                    return ctype, bytes(body)
        except UnsafeURLError:
            raise
        except httpx.HTTPError as exc:
            raise UnsafeURLError(f"fetch failed: {exc}") from exc
    raise UnsafeURLError("too many redirects")
