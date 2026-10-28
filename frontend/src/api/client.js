import axios from "axios";

// Same-origin by default: in dev Vite proxies /api -> Django, in production Vercel
// rewrites /api -> the backend. This keeps the httpOnly refresh cookie first-party.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Opt-in header: tells the backend to keep the refresh token in an httpOnly cookie
// (never in the response body) and to read it from there on /auth/refresh/.
const AUTH_COOKIE_HEADER = { "X-Auth-Cookie": "1" };

const LEGACY_KEYS = { access: "govbot.access", refresh: "govbot.refresh" };

// One-time migration: a refresh token left in localStorage by an older build is sent
// once (in the body) so the server can move it into the cookie. Then it is wiped.
let legacyRefresh = null;
try {
  legacyRefresh = localStorage.getItem(LEGACY_KEYS.refresh);
  localStorage.removeItem(LEGACY_KEYS.access); // access tokens are memory-only now
} catch {
  /* storage unavailable (private mode) — nothing to migrate */
}

function clearLegacyStorage() {
  try {
    localStorage.removeItem(LEGACY_KEYS.access);
    localStorage.removeItem(LEGACY_KEYS.refresh);
  } catch {
    /* ignore */
  }
}

// The access token lives in memory only; the refresh token is never visible to JS.
let accessToken = null;

export const tokenStore = {
  getAccess: () => accessToken,
  // True when we hold an access token, i.e. there is a session worth refreshing.
  hasSession: () => Boolean(accessToken),
  set: ({ access } = {}) => {
    if (access) accessToken = access;
  },
  clear: () => {
    accessToken = null;
  },
};

const api = axios.create({ baseURL: API_BASE_URL, headers: AUTH_COOKIE_HEADER });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function postRefresh() {
  // Consume the legacy token exactly once, whatever the outcome.
  const legacy = legacyRefresh;
  legacyRefresh = null;
  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/refresh/`,
      legacy ? { refresh: legacy } : {},
      { headers: AUTH_COOKIE_HEADER }
    );
    return data.access;
  } finally {
    if (legacy) clearLegacyStorage();
  }
}

// Runs inside the cross-tab lock. A 401 may just mean another tab rotated the cookie
// moments ago, so retry exactly once before giving up.
async function refreshWithRetry() {
  try {
    return await postRefresh();
  } catch (error) {
    if (error?.response?.status !== 401) throw error;
    return postRefresh();
  }
}

function withLock(fn) {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks?.request ? locks.request("govbot-refresh", fn) : fn();
}

// Single-flight access-token refresh, shared by the axios interceptor AND the SSE
// stream (which bypasses axios). Concurrent callers in a tab await the same request;
// across tabs the Web Lock serialises them. Returns the fresh access token. On
// failure it clears the token, signals a logout (unless `silent`, used by the boot-time
// session probe where a 401 simply means "not signed in") and re-throws.
let refreshing = null;

export function refreshAccessToken({ silent = false } = {}) {
  if (!refreshing) {
    refreshing = withLock(refreshWithRetry)
      .then((access) => {
        tokenStore.set({ access });
        return access;
      })
      .catch((error) => {
        tokenStore.clear();
        if (!silent) window.dispatchEvent(new CustomEvent("govbot:logout"));
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const NO_REFRESH_URLS = ["/auth/refresh", "/auth/login", "/auth/register"];

// On 401, try a single refresh, then replay the original request.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Only a request that carried an access token can have an expired session.
    if (
      status !== 401 ||
      !original ||
      original._retry ||
      !original.headers?.Authorization ||
      NO_REFRESH_URLS.some((u) => original.url?.includes(u))
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const access = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${access}`;
      return api(original);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default api;
