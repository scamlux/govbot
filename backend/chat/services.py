"""OpenAI chat service.

Exposes `generate_reply()` (full reply) and `stream_reply()` (token chunks). When
`OPENAI_API_KEY` is unset, the service runs in **mock mode** and returns a clearly-labelled
canned response so the whole app works in development without a key or network access.
"""
import logging
from collections.abc import Iterator

from django.conf import settings

from . import retrieval

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


# Grounding: a localized instruction wrapped around the retrieved reference material. The
# model must prefer these curated facts and admit uncertainty when they don't cover the
# question — this is what keeps a government assistant from inventing fees or deadlines.
GROUNDING_HEADER = {
    "uz": "Quyidagi rasmiy ma'lumotnoma (GovBot katalogidan) javobingizga asos bo'lsin:",
    "ru": "Используйте следующий официальный справочный материал (из каталога GovBot) как основу ответа:",
    "en": "Use the following official reference material (from the GovBot catalog) as the basis for your answer:",
}
GROUNDING_INSTRUCTION = {
    "uz": (
        "Javobingizni ustuvor ravishda shu ma'lumotnomaga asoslang. Tegishli bo'lsa, manba "
        "havolasini ko'rsating. Agar ma'lumotnoma savolni qamrab olmasa, buni ochiq ayting "
        "va foydalanuvchini mas'ul rasmiy organga yo'naltiring — taxmin qilib, aniq raqam, "
        "to'lov yoki muddat o'ylab topmang."
    ),
    "ru": (
        "Основывайте ответ прежде всего на этом материале. Где уместно, укажите ссылку на "
        "источник. Если материал не покрывает вопрос, прямо скажите об этом и направьте "
        "пользователя в ответственный официальный орган — не выдумывайте конкретные суммы, "
        "пошлины или сроки."
    ),
    "en": (
        "Base your answer primarily on this material and cite the source link where "
        "relevant. If it does not cover the question, say so plainly and point the user to "
        "the responsible official body — do not invent specific figures, fees or deadlines."
    ),
}


def _latest_user_query(messages: list[dict]) -> str:
    for message in reversed(messages):
        if message.get("role") == "user":
            return message.get("content", "")
    return ""


def _format_reference(snippets: list[dict], lang: str) -> str:
    blocks = []
    for i, snip in enumerate(snippets, start=1):
        parts = [f"{i}. {snip['title']}".strip(), snip["text"]]
        if snip.get("source_url"):
            parts.append(f"Source: {snip['source_url']}")
        blocks.append("\n".join(p for p in parts if p))
    body = "\n\n".join(blocks)
    return f"{GROUNDING_HEADER[lang]}\n\n{body}\n\n{GROUNDING_INSTRUCTION[lang]}"


def retrieve_snippets(messages: list[dict], language: str) -> list[dict]:
    """Retrieve grounding snippets for the latest user query in ``messages``.

    Returns the raw retrieval output (``[{slug, title, text, source_url, score, mode}]``),
    empty when nothing relevant was found. Callers pass the result to ``build_payload`` /
    ``generate_reply`` / ``stream_reply`` so the catalog is queried exactly once per reply
    and the same snippets can be surfaced to the client as sources (B1).
    """
    lang = _lang(language)
    return retrieval.retrieve(_latest_user_query(messages), lang)


def sources_from_snippets(snippets: list[dict] | None) -> list[dict]:
    """Project retrieval snippets to the client-facing citation shape (B1).

    ``[{slug, title, source_url}]`` — the heavy ``text``/``score`` fields are dropped and
    duplicate scenarios (same slug) are removed while preserving rank order.
    """
    seen: set[str] = set()
    sources: list[dict] = []
    for snip in snippets or []:
        slug = snip.get("slug")
        if not slug or slug in seen:
            continue
        seen.add(slug)
        sources.append(
            {
                "slug": slug,
                "title": snip.get("title", ""),
                "source_url": snip.get("source_url", ""),
            }
        )
    return sources


def build_payload(
    messages: list[dict], language: str, snippets: list[dict] | None = None
) -> list[dict]:
    """Build the OpenAI ``messages`` array: system prompt + grounding + recent history.

    ``snippets`` may be precomputed (via ``retrieve_snippets``) to avoid re-querying the
    catalog; when ``None`` they are retrieved here for backward compatibility.
    """
    lang = _lang(language)
    if snippets is None:
        snippets = retrieve_snippets(messages, lang)
    history = messages[-HISTORY_LIMIT:]
    payload = [{"role": "system", "content": SYSTEM_PROMPTS[lang]}]
    if snippets:
        payload.append({"role": "system", "content": _format_reference(snippets, lang)})
    payload.extend(history)
    return payload


def _client():
    from openai import OpenAI

    return OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_reply(
    messages: list[dict], language: str, snippets: list[dict] | None = None
) -> dict:
    """Return a full assistant reply.

    `messages` is an ordered list of {"role", "content"} dicts (user/assistant only).
    Returns {"content", "model", "tokens", "sources"} where ``sources`` are the grounding
    citations (empty list when ungrounded). ``snippets`` may be precomputed to avoid
    re-querying the catalog.
    """
    lang = _lang(language)
    if snippets is None:
        snippets = retrieve_snippets(messages, lang)
    sources = sources_from_snippets(snippets)

    if is_mock_mode():
        return {"content": MOCK_REPLY[lang], "model": "mock", "tokens": None, "sources": sources}

    payload = build_payload(messages, lang, snippets=snippets)
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
            "sources": sources,
        }
    except Exception:  # noqa: BLE001 — surface a friendly message, log the detail
        logger.exception("OpenAI request failed")
        return {
            "content": FRIENDLY_ERROR[lang],
            "model": settings.OPENAI_MODEL,
            "tokens": None,
            "sources": [],
        }


def stream_reply(
    messages: list[dict], language: str, snippets: list[dict] | None = None
) -> Iterator[str]:
    """Yield assistant reply text chunks (for Server-Sent Events).

    The final accumulated text is the assistant message persisted by the caller.
    ``snippets`` may be precomputed to avoid re-querying the catalog (the caller also
    surfaces them to the client as sources).
    """
    lang = _lang(language)

    if is_mock_mode():
        # Emit the canned reply word-by-word so the UI streaming path is exercised.
        for word in MOCK_REPLY[lang].split(" "):
            yield word + " "
        return

    payload = build_payload(messages, lang, snippets=snippets)
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
