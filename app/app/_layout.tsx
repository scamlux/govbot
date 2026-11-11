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
import { useA11y } from "../src/theme/a11y";

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
  const { palette } = useA11y();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (!onboarded && segments[0] !== "onboarding") router.replace("/onboarding");
  }, [onboarded, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scenario/[slug]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="voice" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="auth" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
      <Stack.Screen name="paywall" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade" }} />
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
