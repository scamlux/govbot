import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nextProvider } from "react-i18next";

import { AuthProvider, useAuth } from "../src/auth/AuthProvider";
import i18n, { initI18n } from "../src/i18n";
import { configureNotifications } from "../src/native/notifications";
import { persistOptions, queryClient, setupOnlineManager } from "../src/query/client";
import { useSettings } from "../src/state/settings";

void SplashScreen.preventAutoHideAsync();
configureNotifications();

/** Resolves once the persisted settings are read, then boots i18n (saved -> device -> uz). */
function useBootstrapped(): boolean {
  const [ready, setReady] = useState(useSettings.persist.hasHydrated());
  useEffect(() => {
    const finish = () => {
      initI18n();
      setReady(true);
    };
    if (useSettings.persist.hasHydrated()) {
      finish();
      return undefined;
    }
    return useSettings.persist.onFinishHydration(finish);
  }, []);
  return ready;
}

function Routes() {
  const { loading } = useAuth();
  const onboarded = useSettings((s) => s.onboarded);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (!onboarded && segments[0] !== "onboarding") router.replace("/onboarding");
  }, [onboarded, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scenario/[slug]" options={{ headerShown: true, title: "" }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: "" }} />
      <Stack.Screen name="auth" options={{ presentation: "modal" }} />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const ready = useBootstrapped();
  useEffect(() => setupOnlineManager(), []);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <AuthProvider>
              <StatusBar style="dark" />
              <Routes />
            </AuthProvider>
          </PersistQueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
