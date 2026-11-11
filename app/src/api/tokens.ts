import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "govbot.refresh";

/** Access token: memory only. Refresh token: Keychain / Keystore via expo-secure-store. */
let accessToken: string | null = null;

export const tokenStore = {
  getAccess: (): string | null => accessToken,
  setAccess: (token: string | null): void => {
    accessToken = token;
  },
  async getRefresh(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  async setRefresh(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },
  async clear(): Promise<void> {
    accessToken = null;
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      /* nothing stored */
    }
  },
};

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();

/** Fired when a refresh is rejected (session truly dead). AuthProvider signs the user out. */
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function emitSessionExpired(): void {
  sessionExpiredListeners.forEach((listener) => listener());
}
