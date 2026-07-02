// D1 — register the PWA service worker (production build only). No-op when the browser
// lacks service worker support or in dev (where the SW would cache the Vite dev server).
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env && import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failures shouldn't break the app */
    });
  });
}
