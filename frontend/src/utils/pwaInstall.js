// PWA install support. `beforeinstallprompt` fires once, early in page load — before the lazy
// /guide chunk exists — so the event is captured at boot (imported in main.jsx) and read later
// by usePwaInstall(). Nothing is sent anywhere: this is purely local browser state.

let deferredPrompt = null;
let installed = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep the native mini-infobar away; the Guide page offers the button
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

/** True when the page already runs as an installed app (standalone / iOS home-screen launch). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  if (installed) return true;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  return window.navigator?.standalone === true;
}

/** iPhone / iPad Safari: no install event exists there, only the Share-sheet route. */
export function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export function canPromptInstall() {
  return deferredPrompt !== null;
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Shows the native install dialog. Resolves to "accepted" | "dismissed" | "unavailable". */
export async function promptInstall() {
  if (!deferredPrompt) return "unavailable";
  const prompt = deferredPrompt;
  deferredPrompt = null; // an event can only be used once
  notify();
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}
