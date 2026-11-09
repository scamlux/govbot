/**
 * Bridge to the Capacitor native shell (mobile/). The app loads this site in a WebView and
 * Capacitor injects `window.Capacitor`; we feature-detect it instead of bundling @capacitor/*.
 * On the plain web every helper degrades to a no-op / web fallback. Nothing here throws.
 */

const MAX_INT32 = 0x7fffffff;

function cap() {
  return typeof window !== "undefined" ? window.Capacitor : undefined;
}

export function isNativeApp() {
  try {
    return Boolean(cap()?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function nativePlugin(name) {
  try {
    if (!isNativeApp()) return null;
    return cap()?.Plugins?.[name] ?? null;
  } catch {
    return null;
  }
}

/** True when a share action exists (native sheet or Web Share API). */
export function canShare() {
  return isNativeApp() || (typeof navigator !== "undefined" && typeof navigator.share === "function");
}

/** Stable positive 32-bit integer for a notification id. */
export function notificationId(key) {
  let h = 0;
  const text = String(key);
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (Math.abs(h) % MAX_INT32) || 1;
}

/** Local 09:00 on an ISO `YYYY-MM-DD` date. */
export function reminderTime(isoDate, hour = 9) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

/**
 * Schedule a local notification. Returns `{ok, reason}`; reason is one of
 * "not-native" | "denied" | "past" | "error" when ok is false.
 */
export async function scheduleReminder({ id, title, body, at }) {
  const plugin = nativePlugin("LocalNotifications");
  if (!plugin) return { ok: false, reason: "not-native" };
  try {
    if (!(at instanceof Date) || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
      return { ok: false, reason: "past" };
    }
    let perm = await plugin.checkPermissions();
    if (perm?.display !== "granted") perm = await plugin.requestPermissions();
    if (perm?.display !== "granted") return { ok: false, reason: "denied" };
    await plugin.schedule({
      notifications: [{ id, title, body, schedule: { at, allowWhileIdle: true } }],
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Share text. Returns "native" | "web" | "copied" | "cancelled" | "failed".
 */
export async function shareText({ title, text, url }) {
  try {
    const native = nativePlugin("Share");
    if (native) {
      await native.share({ title, text, url, dialogTitle: title });
      return "native";
    }
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      return "web";
    }
    const combined = [text, url].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(combined);
    return "copied";
  } catch (err) {
    return err?.name === "AbortError" ? "cancelled" : "failed";
  }
}

/** Light tap feedback; native only. */
export function hapticTap() {
  try {
    const plugin = nativePlugin("Haptics");
    if (!plugin) return;
    const pending = plugin.impact({ style: "LIGHT" });
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  } catch {
    /* haptics are decorative */
  }
}
