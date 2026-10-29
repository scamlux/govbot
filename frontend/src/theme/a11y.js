/**
 * Low-vision mode (round 4): sets html[data-a11y="high"]; the CSS in studio.css forces the XL
 * font scale, solid high-contrast colours, underlined links and a 4px focus ring.
 * Persisted in localStorage `govbot.a11y` ("high" | absent). Storage may be blocked -> try/catch.
 */
const KEY = "govbot.a11y";

export function readA11y() {
  try {
    return localStorage.getItem(KEY) === "high";
  } catch {
    return false;
  }
}

export function applyA11y(on) {
  const root = document.documentElement;
  if (on) root.setAttribute("data-a11y", "high");
  else root.removeAttribute("data-a11y");
}

export function saveA11y(on) {
  try {
    if (on) localStorage.setItem(KEY, "high");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — mode stays for this page view only */
  }
}
