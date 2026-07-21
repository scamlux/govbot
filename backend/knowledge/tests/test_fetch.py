import httpx
import pytest
from django.test import override_settings

from knowledge import fetch
from knowledge.fetch import UnsafeURLError, fetch_url, is_public_host

# A real public IP (Google DNS) — literal, so is_public_host resolves it without DNS/network.
PUBLIC_IP = "8.8.8.8"


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "::1", "0.0.0.0", "localhost"],
)
def test_private_hosts_rejected(host):
    assert is_public_host(host) is False


def test_public_ip_allowed():
    assert is_public_host(PUBLIC_IP) is True


def test_bad_scheme_rejected():
    with pytest.raises(UnsafeURLError):
        fetch_url("ftp://example.com/file")
    with pytest.raises(UnsafeURLError):
        fetch_url("file:///etc/passwd")


def test_private_host_url_rejected():
    with pytest.raises(UnsafeURLError):
        fetch_url("http://127.0.0.1/admin")
    with pytest.raises(UnsafeURLError):
        fetch_url("http://169.254.169.254/latest/meta-data/")


def _install_transport(monkeypatch, handler):
    monkeypatch.setattr(
        fetch, "_make_client",
        lambda: httpx.Client(follow_redirects=False, transport=httpx.MockTransport(handler)),
    )


def test_successful_fetch(monkeypatch):
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, content=b"<p>ok</p>")

    _install_transport(monkeypatch, handler)
    ctype, body = fetch_url(f"http://{PUBLIC_IP}/page")
    assert ctype == "text/html"
    assert body == b"<p>ok</p>"


def test_redirect_to_private_rejected(monkeypatch):
    def handler(request):
        return httpx.Response(302, headers={"location": "http://127.0.0.1/secret"})

    _install_transport(monkeypatch, handler)
    with pytest.raises(UnsafeURLError):
        fetch_url(f"http://{PUBLIC_IP}/redir")


def test_bad_content_type_rejected(monkeypatch):
    def handler(request):
        return httpx.Response(200, headers={"content-type": "application/zip"}, content=b"PK")

    _install_transport(monkeypatch, handler)
    with pytest.raises(UnsafeURLError):
        fetch_url(f"http://{PUBLIC_IP}/file")


@override_settings(KB_FETCH_MAX_BYTES=100)
def test_oversize_rejected(monkeypatch):
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/plain"}, content=b"x" * 500)

    _install_transport(monkeypatch, handler)
    with pytest.raises(UnsafeURLError):
        fetch_url(f"http://{PUBLIC_IP}/big")
