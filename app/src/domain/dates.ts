import type { Lang } from "../config";

const MS_DAY = 86_400_000;
const LOCALE: Record<Lang, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days from `now` to `target` (0 = today, negative = past). */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(target) - startOfDay(now)) / MS_DAY);
}

export type DateBucket = "today" | "week" | "earlier";

/** Group key for history lists: today / last 7 days / earlier. */
export function bucketFor(iso: string, now: Date = new Date()): DateBucket {
  const diff = daysUntil(new Date(iso), now);
  if (diff >= 0) return "today";
  if (diff > -7) return "week";
  return "earlier";
}

export function formatDate(iso: string | Date, lang: Lang): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return date.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatTime(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(11, 16);
  }
}

export function weekdayShort(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(LOCALE[lang], { weekday: "short" });
  } catch {
    return "";
  }
}

export function dayAndMonth(iso: string, lang: Lang): { day: string; month: string } {
  const date = new Date(iso);
  let month = "";
  try {
    month = date.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "").toUpperCase();
  } catch {
    month = String(date.getMonth() + 1);
  }
  return { day: String(date.getDate()), month };
}

/** Greeting key by hour of day. */
export function greetingKey(now: Date = new Date()): "goodMorning" | "goodDay" | "goodEvening" {
  const h = now.getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodDay";
  return "goodEvening";
}
