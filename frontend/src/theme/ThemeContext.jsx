import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Per-device appearance: light/dark/system mode, accent colour, font scale, and
 * chat background — Telegram-style personalisation. Persisted to localStorage and
 * applied as data-* attributes on <html>, which the CSS reads to swap tokens.
 */

export const ACCENTS = ["teal", "blue", "violet", "green", "rose", "amber"];
export const FONT_SCALES = ["s", "m", "l"];
export const CHAT_BACKGROUNDS = ["plain", "tile", "dots", "warm", "cool"];
const MODES = ["light", "dark", "system"];

const KEY = "govbot.appearance";
const DEFAULTS = { mode: "system", accent: "teal", font: "m", chatBg: "plain" };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      mode: MODES.includes(saved.mode) ? saved.mode : DEFAULTS.mode,
      accent: ACCENTS.includes(saved.accent) ? saved.accent : DEFAULTS.accent,
      font: FONT_SCALES.includes(saved.font) ? saved.font : DEFAULTS.font,
      chatBg: CHAT_BACKGROUNDS.includes(saved.chatBg) ? saved.chatBg : DEFAULTS.chatBg,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [appearance, setAppearance] = useState(load);
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Track OS theme changes so "system" mode stays live.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const resolvedDark = appearance.mode === "dark" || (appearance.mode === "system" && systemDark);

  // Reflect appearance onto <html> for the CSS to key off, and persist.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedDark ? "dark" : "light");
    root.setAttribute("data-accent", appearance.accent);
    root.setAttribute("data-font", appearance.font);
    root.setAttribute("data-chat-bg", appearance.chatBg);
    try {
      localStorage.setItem(KEY, JSON.stringify(appearance));
    } catch {
      /* storage unavailable — appearance stays in-memory */
    }
  }, [appearance, resolvedDark]);

  const set = useCallback((patch) => setAppearance((prev) => ({ ...prev, ...patch })), []);
  const reset = useCallback(() => setAppearance({ ...DEFAULTS }), []);

  const value = useMemo(
    () => ({ ...appearance, resolvedDark, set, reset }),
    [appearance, resolvedDark, set, reset]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
