import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { authApi } from "../api/endpoints";
import { tokenStore } from "../api/client";

const AuthContext = createContext(null);

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
    const refresh = tokenStore.getRefresh();
    if (revoke && refresh) authApi.logout(refresh).catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  // Bootstrap: if we have a token, fetch the profile.
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!tokenStore.getAccess()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await authApi.me();
        if (active) applyUser(data);
      } catch {
        tokenStore.clear();
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
      tokenStore.set({ access: data.access, refresh: data.refresh });
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
      tokenStore.set({ access: data.access, refresh: data.refresh });
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
