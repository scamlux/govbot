import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";

import { isApiError } from "../api/errors";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Public catalog data persisted for offline reading; chat and billing are never persisted. */
export const PERSISTED_ROOTS = ["categories", "scenarios", "scenario", "config"] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * MINUTE,
      gcTime: 7 * DAY, // must be >= persister maxAge or restored data is dropped
      retry: (failureCount, error) =>
        !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
      refetchOnReconnect: true,
      networkMode: "offlineFirst",
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "govbot.query-cache",
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 7 * DAY,
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query): boolean =>
      query.state.status === "success" &&
      PERSISTED_ROOTS.includes(query.queryKey[0] as (typeof PERSISTED_ROOTS)[number]),
  },
};

/** Wire react-query's online state to NetInfo. Returns the unsubscribe. */
export function setupOnlineManager(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false)),
  );
  return () => onlineManager.setEventListener(() => () => undefined);
}

export const queryKeys = {
  config: ["config"] as const,
  categories: (lang: string) => ["categories", lang] as const,
  scenarios: (lang: string, filters: object) => ["scenarios", lang, filters] as const,
  scenario: (lang: string, slug: string) => ["scenario", lang, slug] as const,
  conversations: ["conversations"] as const,
  conversation: (id: number) => ["conversation", id] as const,
  billingPlans: (lang: string) => ["billing", "plans", lang] as const,
  billingMe: ["billing", "me"] as const,
};
