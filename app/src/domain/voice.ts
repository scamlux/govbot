import type { Lang } from "../config";

const LOCALE: Record<Lang, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };
/** Fallback order when the requested language has no recogniser. */
const FALLBACK: Record<Lang, Lang[]> = { uz: ["ru", "en"], ru: ["en"], en: ["ru"] };

export interface VoicePick {
  /** BCP-47 locale to recognise with. */
  locale: string;
  /** App language that locale corresponds to. */
  lang: Lang;
  /** True when we had to fall back from the requested language. */
  fellBack: boolean;
}

const matches = (supported: readonly string[], lang: Lang): string | undefined =>
  supported.find((l) => l.toLowerCase().replace("_", "-").startsWith(lang));

/**
 * Choose a recognition locale: the UI language if supported, else ru/en. When the supported list
 * is empty/unknown we optimistically try the requested language first.
 */
export function pickVoiceLocale(requested: Lang, supported: readonly string[]): VoicePick {
  if (supported.length === 0) return { locale: LOCALE[requested], lang: requested, fellBack: false };
  const direct = matches(supported, requested);
  if (direct) return { locale: direct, lang: requested, fellBack: false };
  for (const lang of FALLBACK[requested]) {
    const found = matches(supported, lang);
    if (found) return { locale: found, lang, fellBack: true };
  }
  return { locale: LOCALE[requested], lang: requested, fellBack: false };
}

/** Map recogniser volume (dB, roughly -2..10) to 0..1. */
export const volumeToLevel = (db: number): number => Math.max(0, Math.min(1, (db + 2) / 12));
