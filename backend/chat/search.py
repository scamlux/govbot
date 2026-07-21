"""Pluggable live web-search provider for the Phase C RAG fallback.

When neither the Scenario Catalog nor the Knowledge Base covers a question, ``web_search``
fetches fresh material so the assistant can still answer. It is OFF by default
(``KB_SEARCH_PROVIDER='none'``) — the app is unaffected until a provider + key are set.
Results are scoped to official domains (``KB_SEARCH_DOMAINS``). Generation still uses the
existing OpenAI model, so the only added cost is the search provider's free tier.

Never raises: any misconfiguration or network error returns ``[]`` so a failed search just
degrades to an ungrounded answer.
"""
import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_TAVILY_URL = "https://api.tavily.com/search"


def _provider() -> str:
    return (getattr(settings, "KB_SEARCH_PROVIDER", "none") or "none").lower()


def _max_results() -> int:
    return int(getattr(settings, "KB_SEARCH_MAX_RESULTS", 3))


def _domains() -> list[str]:
    raw = getattr(settings, "KB_SEARCH_DOMAINS", "") or ""
    return [d.strip() for d in raw.split(",") if d.strip()]


def _make_client() -> httpx.Client:
    """HTTP client (indirection point so tests can inject a MockTransport)."""
    return httpx.Client(timeout=float(getattr(settings, "KB_FETCH_TIMEOUT", 15)))


def web_search(query: str, language: str | None = None) -> list[dict]:
    """Return ``[{title, url, content}]`` from the configured provider (``[]`` when off)."""
    provider = _provider()
    if provider == "none" or not (query or "").strip():
        return []
    if provider == "tavily":
        return _tavily_search(query)
    logger.warning("Unknown KB_SEARCH_PROVIDER %r", provider)
    return []


def _tavily_search(query: str) -> list[dict]:
    api_key = getattr(settings, "TAVILY_API_KEY", "") or ""
    if not api_key:
        return []
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": _max_results(),
        "search_depth": "basic",
        "include_answer": False,
    }
    domains = _domains()
    if domains:
        payload["include_domains"] = domains
    try:
        with _make_client() as client:
            resp = client.post(_TAVILY_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("Tavily search failed", exc_info=True)
        return []
    results = []
    for item in (data.get("results") or [])[: _max_results()]:
        results.append(
            {
                "title": item.get("title") or item.get("url") or "",
                "url": item.get("url") or "",
                "content": item.get("content") or "",
            }
        )
    return results
