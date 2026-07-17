import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const STORAGE = {
  access: "govbot.access",
  refresh: "govbot.refresh",
};

export const tokenStore = {
  getAccess: () => localStorage.getItem(STORAGE.access),
  getRefresh: () => localStorage.getItem(STORAGE.refresh),
  set: ({ access, refresh }) => {
    if (access) localStorage.setItem(STORAGE.access, access);
    if (refresh) localStorage.setItem(STORAGE.refresh, refresh);
  },
  clear: () => {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
  },
};

const api = axios.create({ baseURL: API_BASE_URL });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight access-token refresh, shared by the axios interceptor AND the SSE
// stream (which bypasses axios and so cannot rely on the interceptor). Concurrent
// callers await the same in-flight request. Returns the fresh access token; on
// failure it clears tokens, signals a logout, and re-throws.
let refreshing = null;

export async function refreshAccessToken() {
  const refresh = tokenStore.getRefresh();
  if (!refresh) throw new Error("No refresh token");
  try {
    refreshing =
      refreshing || axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
    const { data } = await refreshing;
    refreshing = null;
    tokenStore.set({ access: data.access, refresh: data.refresh });
    return data.access;
  } catch (refreshError) {
    refreshing = null;
    tokenStore.clear();
    // Surface a recognizable event so the auth context can log out.
    window.dispatchEvent(new CustomEvent("govbot:logout"));
    throw refreshError;
  }
}

// On 401, try a single refresh, then replay the original request.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || original._retry || !tokenStore.getRefresh()) {
      return Promise.reject(error);
    }
    // Don't try to refresh the refresh endpoint itself.
    if (original.url?.includes("/auth/refresh")) {
      tokenStore.clear();
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
