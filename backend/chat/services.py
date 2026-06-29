"""OpenAI chat service.

Exposes `generate_reply()` (full reply) and `stream_reply()` (token chunks). When
`OPENAI_API_KEY` is unset, the service runs in **mock mode** and returns a clearly-labelled
canned response so the whole app works in development without a key or network access.
"""
import logging
from collections.abc import Iterator

from django.conf import settings

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 10  # number of recent messages sent for context

SYSTEM_PROMPTS = {
    "uz": (
        "Siz GovBot — O'zbekiston davlat va jamoat xizmatlari bo'yicha yordamchisiz. "
        "Foydalanuvchining tilida (o'zbekcha) qisqa, aniq va faktik javob bering. "
        "Agar ma'lumot eskirgan bo'lishi mumkin bo'lsa yoki rasmiy organda tasdiqlash "
        "kerak bo'lsa, buni aniq ayting. Aniq bilmasangiz, qonun moddalari raqamlari, "
        "to'lovlar yoki muddatlarni o'ylab topmang — buning o'rniga mas'ul rasmiy organga "
        "yo'naltiring."
    ),
    "ru": (
        "Вы GovBot — помощник по государственным и публичным услугам Узбекистана. "
        "Отвечайте на языке пользователя (русском) кратко, точно и фактологически. "
        "Если информация может быть устаревшей или её нужно подтвердить в официальном "
        "органе, прямо укажите это. Если вы не уверены, не выдумывайте номера статей "
        "законов, пошлины или сроки — вместо этого направьте к ответственному "
        "официальному органу."
    ),
    "en": (
        "You are GovBot — an assistant for Uzbekistan government and public-service "
        "information. Answer in the user's language (English), concisely and factually. "
        "If information may be outdated or should be verified with the official agency, "
        "say so clearly. If you are not sure, never invent specific legal article numbers, "
        "fees or deadlines — instead point the user to the responsible official body."
    ),
}

FRIENDLY_ERROR = {
    "uz": "Kechirasiz, hozir javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    "ru": "Извините, произошла ошибка при ответе. Пожалуйста, повторите попытку позже.",
    "en": "Sorry, something went wrong while answering. Please try again in a moment.",
}

MOCK_REPLY = {
    "uz": (
        "**[Demo rejimi — OpenAI kaliti sozlanmagan]**\n\n"
        "Salom! Men GovBot man. Hozir namoyish rejimida ishlayapman, shuning uchun haqiqiy "
        "AI javobini bera olmayman. `OPENAI_API_KEY` ni sozlaganingizdan so'ng men sizning "
        "savolingizga to'liq javob beraman. Aniq ma'lumot uchun rasmiy davlat organiga "
        "murojaat qilishni unutmang."
    ),
    "ru": (
        "**[Демо-режим — ключ OpenAI не настроен]**\n\n"
        "Здравствуйте! Я GovBot. Сейчас я работаю в демонстрационном режиме и не могу дать "
        "настоящий ответ ИИ. После настройки `OPENAI_API_KEY` я смогу полноценно отвечать на "
        "ваши вопросы. Для точной информации обращайтесь в официальный государственный орган."
    ),
    "en": (
        "**[Demo mode — OpenAI key not configured]**\n\n"
        "Hello! I'm GovBot. I'm running in demo mode, so I can't give a real AI answer yet. "
        "Once `OPENAI_API_KEY` is configured I'll be able to answer your question fully. For "
        "accurate details, please confirm with the responsible official agency."
    ),
}


def _lang(language: str) -> str:
    return language if language in SYSTEM_PROMPTS else "uz"


def is_mock_mode() -> bool:
    return not bool(settings.OPENAI_API_KEY)


def build_payload(messages: list[dict], language: str) -> list[dict]:
    """Build the OpenAI `messages` array: system prompt + recent history."""
    lang = _lang(language)
    history = messages[-HISTORY_LIMIT:]
    return [{"role": "system", "content": SYSTEM_PROMPTS[lang]}, *history]


def _client():
    from openai import OpenAI

    return OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_reply(messages: list[dict], language: str) -> dict:
    """Return a full assistant reply.

    `messages` is an ordered list of {"role", "content"} dicts (user/assistant only).
    Returns {"content", "model", "tokens"}.
    """
    lang = _lang(language)

    if is_mock_mode():
        return {"content": MOCK_REPLY[lang], "model": "mock", "tokens": None}

    payload = build_payload(messages, lang)
    try:
        response = _client().chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=payload,
            temperature=settings.OPENAI_TEMPERATURE,
            max_tokens=settings.OPENAI_MAX_TOKENS,
        )
        choice = response.choices[0]
        usage = getattr(response, "usage", None)
        return {
            "content": choice.message.content or "",
            "model": settings.OPENAI_MODEL,
            "tokens": getattr(usage, "total_tokens", None) if usage else None,
        }
    except Exception:  # noqa: BLE001 — surface a friendly message, log the detail
        logger.exception("OpenAI request failed")
        return {"content": FRIENDLY_ERROR[lang], "model": settings.OPENAI_MODEL, "tokens": None}


def stream_reply(messages: list[dict], language: str) -> Iterator[str]:
    """Yield assistant reply text chunks (for Server-Sent Events).

    The final accumulated text is the assistant message persisted by the caller.
    """
    lang = _lang(language)

    if is_mock_mode():
        # Emit the canned reply word-by-word so the UI streaming path is exercised.
        for word in MOCK_REPLY[lang].split(" "):
            yield word + " "
        return

    payload = build_payload(messages, lang)
    try:
        stream = _client().chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=payload,
            temperature=settings.OPENAI_TEMPERATURE,
            max_tokens=settings.OPENAI_MAX_TOKENS,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
    except Exception:  # noqa: BLE001
        logger.exception("OpenAI streaming request failed")
        yield FRIENDLY_ERROR[lang]
