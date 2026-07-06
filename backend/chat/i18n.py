"""Localized server-side strings for chat API errors (uz/ru/en).

API error bodies are user-facing (the frontend shows them verbatim), so they follow the
same three-language rule as the UI. Resolution order matches the product-wide fallback:
requested language → user's preferred language → uz.
"""

SUPPORTED_LANGUAGES = ("uz", "ru", "en")

THROTTLED_MESSAGE = {
    "uz": "Juda ko'p so'rov yubordingiz. Iltimos, birozdan so'ng qayta urinib ko'ring.",
    "ru": "Слишком много запросов. Пожалуйста, повторите попытку немного позже.",
    "en": "Too many requests. Please wait a moment and try again.",
}

MESSAGE_TOO_LONG = {
    "uz": "Xabar juda uzun — ko'pi bilan {max} ta belgi yuborish mumkin.",
    "ru": "Сообщение слишком длинное — не более {max} символов.",
    "en": "Message is too long — maximum {max} characters.",
}

MESSAGE_EMPTY = {
    "uz": "Xabar matni bo'sh bo'lishi mumkin emas.",
    "ru": "Сообщение не может быть пустым.",
    "en": "Message content cannot be empty.",
}


def resolve_language(candidate=None, user=None) -> str:
    """Pick the best language for an API error message."""
    if candidate in SUPPORTED_LANGUAGES:
        return candidate
    preferred = getattr(user, "preferred_language", None)
    if preferred in SUPPORTED_LANGUAGES:
        return preferred
    return "uz"
