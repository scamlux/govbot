import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Per-device appearance: accent colour, font scale and chat background. The site has one
 * theme (light "Samarqand × Paxta", styles/civic.css), so there is no theme switch. Persisted to localStorage and
 * applied as data-* attributes on <html>, which the CSS reads to swap tokens.
 */

export const ACCENTS = ["teal", "blue", "violet", "green", "rose", "amber"];
export const FONT_SCALES = ["s", "m", "l", "xl"];
export const CHAT_BACKGROUNDS = ["plain", "tile", "dots", "warm", "cool"];

const KEY = "govbot.appearance";
const DEFAULTS = { accent: "teal", font: "m", chatBg: "plain" };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      accent: ACCENTS.includes(saved.accent) ? saved.accent : DEFAULTS.accent,
      font: FONT_SCALES.includes(saved.font) ? saved.font : DEFAULTS.font,
      chatBg: CHAT_BACKGROUNDS.includes(saved.chatBg) ? saved.chatBg : DEFAULTS.chatBg,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [appearance, setAppearance] = useState(load);

  // Reflect appearance onto <html> for the CSS to key off, and persist.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    root.setAttribute("data-accent", appearance.accent);
    root.setAttribute("data-font", appearance.font);
    root.setAttribute("data-chat-bg", appearance.chatBg);
    try {
      localStorage.setItem(KEY, JSON.stringify(appearance));
    } catch {
      /* storage unavailable — appearance stays in-memory */
    }
  }, [appearance]);

  const set = useCallback((patch) => setAppearance((prev) => ({ ...prev, ...patch })), []);
  const reset = useCallback(() => setAppearance({ ...DEFAULTS }), []);

  const value = useMemo(() => ({ ...appearance, set, reset }), [appearance, set, reset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
