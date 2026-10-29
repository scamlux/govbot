import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { authApi } from "../api/endpoints";
import { tokenStore, refreshAccessToken } from "../api/client";

const AuthContext = createContext(null);

// Non-sensitive hint (no token) that this browser once signed in. Without it a first-time
// visitor skips the silent refresh probe entirely (no useless 400 / cold-start wait).
export const SESSION_HINT_KEY = "govbot.hasSession";
export function hasSessionHint() {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}
export function setSessionHint(on) {
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* storage unavailable — hint is only an optimisation */
  }
}

export function AuthProvider({ children }) {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback(
    (nextUser) => {
      setUser(nextUser);
      // D2 — inside the widget iframe the host page's ?lang= wins over the profile.
      const embedded = window.location.pathname.startsWith("/embed");
      if (
        !embedded &&
        nextUser?.preferred_language &&
        nextUser.preferred_language !== i18n.language
      ) {
        i18n.changeLanguage(nextUser.preferred_language);
      }
    },
    [i18n]
  );

  // F2 — revoke the refresh token server-side, then clear local state. The revoke is
  // fire-and-forget: logging out must work offline or when the API is down.
  const logout = useCallback(({ revoke = true } = {}) => {
    // The refresh cookie travels with the request; there is no token for JS to send.
    if (revoke) authApi.logout().catch(() => {});
    tokenStore.clear();
    setSessionHint(false);
    setUser(null);
  }, []);

  // Bootstrap: the access token is memory-only, so after a reload try ONE silent
  // refresh (httpOnly cookie) before deciding whether the user is signed in. The
  // embeddable widget is always a guest and skips this entirely.
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (window.location.pathname.startsWith("/embed") || !hasSessionHint()) {
        setLoading(false);
        return;
      }
      try {
        if (!tokenStore.getAccess()) await refreshAccessToken({ silent: true });
        const { data } = await authApi.me();
        if (active) applyUser(data);
      } catch (error) {
        tokenStore.clear();
        // The server said the session is gone: forget the hint. Network errors keep it.
        const status = error?.response?.status;
        if (status >= 400 && status < 500) setSessionHint(false);
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [applyUser]);

  // React to forced logout from the axios interceptor (refresh failure).
  useEffect(() => {
    // The token is already invalid here, so don't try to revoke it again.
    const handler = () => logout({ revoke: false });
    window.addEventListener("govbot:logout", handler);
    return () => window.removeEventListener("govbot:logout", handler);
  }, [logout]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await authApi.login({ email, password });
      tokenStore.set({ access: data.access });
      setSessionHint(true);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const register = useCallback(
    async ({ email, password, fullName, language }) => {
      const { data } = await authApi.register({
        email,
        password,
        full_name: fullName,
        preferred_language: language,
      });
      tokenStore.set({ access: data.access });
      setSessionHint(true);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const updatePreferredLanguage = useCallback(
    async (lang) => {
      if (!user) return;
      try {
        const { data } = await authApi.updateMe({ preferred_language: lang });
        setUser(data);
      } catch {
        /* non-fatal: language still applied locally */
      }
    },
    [user]
  );

  const updateProfile = useCallback(async (patch) => {
    const { data } = await authApi.updateMe(patch);
    setUser(data);
    return data;
  }, []);

  const value = {
    user,
    loading,
    isAdmin: Boolean(user?.is_staff),
    login,
    register,
    logout,
    updatePreferredLanguage,
    updateProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
