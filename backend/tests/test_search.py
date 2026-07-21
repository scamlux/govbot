"""C1 — pluggable web-search provider (Tavily), off by default, never raises."""
import httpx
from django.test import override_settings

from chat import search


def _install_transport(monkeypatch, handler):
    monkeypatch.setattr(
        search, "_make_client",
        lambda: httpx.Client(transport=httpx.MockTransport(handler)),
    )


@override_settings(KB_SEARCH_PROVIDER="none")
def test_provider_none_returns_empty(monkeypatch):
    called = {"hit": False}

    def handler(request):  # pragma: no cover — must never run
        called["hit"] = True
        return httpx.Response(200, json={})

    _install_transport(monkeypatch, handler)
    assert search.web_search("passport") == []
    assert called["hit"] is False


@override_settings(KB_SEARCH_PROVIDER="tavily", TAVILY_API_KEY="k", KB_SEARCH_MAX_RESULTS=3)
def test_tavily_parses_results(monkeypatch):
    def handler(request):
        return httpx.Response(
            200,
            json={
                "results": [
                    {"title": "Passport", "url": "https://gov.uz/p", "content": "How to renew."},
                    {"title": "Visa", "url": "https://gov.uz/v", "content": "Visa rules."},
                ]
            },
        )

    _install_transport(monkeypatch, handler)
    out = search.web_search("passport renewal")
    assert out == [
        {"title": "Passport", "url": "https://gov.uz/p", "content": "How to renew."},
        {"title": "Visa", "url": "https://gov.uz/v", "content": "Visa rules."},
    ]


@override_settings(KB_SEARCH_PROVIDER="tavily", TAVILY_API_KEY="k")
def test_tavily_http_error_returns_empty(monkeypatch):
    def handler(request):
        return httpx.Response(500, text="boom")

    _install_transport(monkeypatch, handler)
    assert search.web_search("passport") == []


@override_settings(KB_SEARCH_PROVIDER="tavily", TAVILY_API_KEY="")
def test_tavily_without_key_returns_empty():
    assert search.web_search("passport") == []
