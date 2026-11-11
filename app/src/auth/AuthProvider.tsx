import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authApi } from "../api/endpoints";
import { refreshAccessToken } from "../api/refresh";
import { onSessionExpired, tokenStore } from "../api/tokens";
import type { AuthResponse, User } from "../api/types";
import type { Lang } from "../config";
import { applyLanguage, isLang } from "../i18n";
import { queryClient } from "../query/client";

export interface RegisterInput {
  email: string;
  password: string;
  full_name?: string;
  preferred_language?: Lang;
}

export interface AuthContextValue {
  user: User | null;
  /** True until the boot-time session probe finishes. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-read `/auth/me/` (after a profile PATCH). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function acceptSession(data: AuthResponse): Promise<User> {
  tokenStore.setAccess(data.access);
  if (data.refresh) await tokenStore.setRefresh(data.refresh);
  if (isLang(data.user.preferred_language)) await applyLanguage(data.user.preferred_language);
  return data.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const wipeSession = useCallback(async () => {
    await tokenStore.clear();
    queryClient.removeQueries({ queryKey: ["conversations"] });
    queryClient.removeQueries({ queryKey: ["conversation"] });
    queryClient.removeQueries({ queryKey: ["billing"] });
    setUser(null);
  }, []);

  // Boot: if a refresh token is stored, silently mint an access token and load the profile.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!(await tokenStore.getRefresh())) return;
        await refreshAccessToken({ silent: true });
        const me = await authApi.me();
        if (active) setUser(me);
      } catch {
        /* rejected: tokens already wiped; offline: user stays signed out until next launch */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // A rejected refresh anywhere (REST or SSE) signs the user out.
  useEffect(() => onSessionExpired(() => void wipeSession()), [wipeSession]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await acceptSession(await authApi.login({ email, password }));
    setUser(next);
    return next;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await acceptSession(await authApi.register(input));
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // posts the refresh token first, then we wipe
    } catch {
      /* best effort: local wipe below always happens */
    }
    await wipeSession();
  }, [wipeSession]);

  const refreshUser = useCallback(async () => {
    setUser(await authApi.me());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
