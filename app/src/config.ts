/** Production API (the Vercel rewrite in front of the Django backend). */
export const DEFAULT_API_BASE = "https://govbot-web.vercel.app/api";

export const API_BASE: string = (process.env.EXPO_PUBLIC_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");

export const SUPPORTED_LANGS = ["uz", "ru", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = "uz";

/** Official hotlines (112 emergency, 1173 / 1242 government info). */
export const HOTLINES = ["112", "1173", "1242"] as const;

export const REMINDER_HOUR = 9;
