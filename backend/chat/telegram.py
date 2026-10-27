"""D1 — Telegram bot channel on top of the same grounded chat pipeline.

Telegram calls ``POST /api/telegram/webhook/`` for every update. The view:

* refuses with 404 unless ``TELEGRAM_BOT_TOKEN`` is configured (endpoint is invisible
  until an operator opts in), and with 403 unless the request carries
  ``X-Telegram-Bot-Api-Secret-Token == TELEGRAM_WEBHOOK_SECRET``;
* answers ``/start`` and ``/help`` with a localized greeting, and any other text with a
  grounded reply from ``services.generate_reply`` (catalog/KB retrieval, PII masking,
  catalog-only kill-switch — the exact web-chat behaviour);
* is stateless: no conversation is persisted, each message is answered on its own, so no
  Telegram user data is stored in the GovBot database;
* is throttled per Telegram chat id (``TELEGRAM_THROTTLE``).

Register the webhook once (see DEPLOY notes in CLAUDE.md):
``https://api.telegram.org/bot<TOKEN>/setWebhook?url=<API>/telegram/webhook/&secret_token=<SECRET>``
"""
import hmac
import logging

import httpx
from django.conf import settings
from django.http import Http404
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import safety, services
from .throttles import TelegramChatThrottle

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"
TELEGRAM_MAX_CHARS = 4096

GREETING = {
    "uz": (
        "Assalomu alaykum! Men GovBot — O'zbekistondagi davlat xizmatlari bo'yicha "
        "yordamchiman. Savolingizni yozing. Javoblar maslahat xarakterida, muhim "
        "qarorlardan oldin mas'ul idorada tekshiring."
    ),
    "ru": (
        "Здравствуйте! Я GovBot — помощник по госуслугам Узбекистана. Напишите вопрос. "
        "Ответы носят справочный характер, перед важными решениями уточняйте в "
        "ответственном ведомстве."
    ),
    "en": (
        "Hello! I'm GovBot, an assistant for public services in Uzbekistan. Send me your "
        "question. Answers are for guidance only; confirm with the responsible agency "
        "before acting."
    ),
}
LIMITED = {
    "uz": "Juda ko'p so'rov. Birozdan keyin qayta urinib ko'ring.",
    "ru": "Слишком много запросов. Попробуйте чуть позже.",
    "en": "Too many requests. Please try again a little later.",
}


def _language_for(message: dict, text: str) -> str:
    """Pick the reply language: the question's own language, else the Telegram UI one."""
    code = ((message.get("from") or {}).get("language_code") or "").split("-")[0]
    fallback = code if code in ("uz", "ru", "en") else "uz"
    return safety.resolve_reply_language(text, fallback)


def send_message(chat_id: int, text: str) -> None:
    """Send ``text`` to a chat, split to Telegram's 4096-char limit. Failures are logged."""
    url = f"{TELEGRAM_API}/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    for start in range(0, len(text) or 1, TELEGRAM_MAX_CHARS):
        chunk = text[start : start + TELEGRAM_MAX_CHARS]
        try:
            httpx.post(
                url,
                json={"chat_id": chat_id, "text": chunk, "disable_web_page_preview": True},
                timeout=10,
            )
        except httpx.HTTPError:
            logger.exception("Telegram sendMessage failed for chat %s", chat_id)
            return


def _format_sources(sources: list[dict]) -> str:
    lines = []
    for src in sources or []:
        url = src.get("source_url") or src.get("url")
        title = src.get("title") or url
        if url:
            lines.append(f"• {title}: {url}")
    return "\n".join(lines)


class TelegramWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [TelegramChatThrottle]

    def initial(self, request, *args, **kwargs):
        if not getattr(settings, "TELEGRAM_BOT_TOKEN", ""):
            raise Http404
        expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
        given = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not expected or not hmac.compare_digest(given, expected):
            raise PermissionDenied("Bad webhook secret.")
        message = (request.data or {}).get("message") or {}
        request.telegram_chat_id = (message.get("chat") or {}).get("id")
        super().initial(request, *args, **kwargs)

    def throttled(self, request, wait):
        chat_id = getattr(request, "telegram_chat_id", None)
        if chat_id is not None:
            send_message(chat_id, LIMITED["uz"])
        raise Throttled(wait=wait)

    def post(self, request):
        message = (request.data or {}).get("message") or {}
        chat_id = (message.get("chat") or {}).get("id")
        text = (message.get("text") or "").strip()
        # Always 200 so Telegram doesn't retry updates we deliberately ignore.
        if chat_id is None or not text:
            return Response({"ok": True})

        lang = _language_for(message, text)
        if text.split()[0] in ("/start", "/help"):
            send_message(chat_id, GREETING[lang])
            return Response({"ok": True})

        max_chars = getattr(settings, "CHAT_MAX_MESSAGE_CHARS", 4000)
        history = [{"role": "user", "content": text[:max_chars]}]
        snippets = services.retrieve_snippets(history, lang)
        reply = services.generate_reply(history, lang, snippets=snippets)
        body = reply["content"]
        sources = _format_sources(reply.get("sources") or [])
        if sources:
            body = f"{body}\n\n{sources}"
        send_message(chat_id, body)
        return Response({"ok": True})
