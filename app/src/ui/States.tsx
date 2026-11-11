import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Linking, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useOnline } from "../native/useOnline";
import { useA11y } from "../theme/a11y";
import { Icon, type IconName } from "./icons";
import { PressableScale } from "./PressableScale";
import { SkeletonList } from "./Skeleton";
import { T } from "./primitives";

/** Dark "Oflayn rejim" banner, shown only while NetInfo reports no connection. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const { reduceMotion } = useA11y();
  if (online) return null;
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      entering={reduceMotion ? undefined : FadeInDown.duration(220)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(150)}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "#1D1D1F" }}
    >
      <Icon name="wifiOff" size={20} color="#FFFFFF" />
      <View style={{ flex: 1 }}>
        <T variant="subhead" color="#FFFFFF">
          <T variant="subhead" weight="700" color="#FFFFFF">{t("m.states.offlineTitle")} </T>
          {t("m.states.offlineBody")}
        </T>
      </View>
    </Animated.View>
  );
}

export function EmptyState({ icon = "cases", title, body, cta, onCta }: { icon?: IconName; title: string; body?: string; cta?: string; onCta?: () => void }) {
  const { palette } = useA11y();
  return (
    <View style={{ alignItems: "center", gap: 10, padding: 26, paddingHorizontal: 20, borderRadius: 24, backgroundColor: palette.surface }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: palette.accentTint, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={28} color={palette.accentPressed} />
      </View>
      <T variant="headline" weight="700" style={{ textAlign: "center" }}>{title}</T>
      {body ? <T variant="callout" muted style={{ textAlign: "center" }}>{body}</T> : null}
      {cta && onCta ? (
        <PressableScale
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={cta}
          style={{ marginTop: 4, minHeight: 46, paddingHorizontal: 20, borderRadius: 16, backgroundColor: palette.accentTint, alignItems: "center", justifyContent: "center" }}
        >
          <T variant="subhead" weight="700" color={palette.accentPressed}>{cta}</T>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Error card with retry and a 1242 call button (design: States). */
export function ErrorState({ title, body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { palette } = useA11y();
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", gap: 10, padding: 26, paddingHorizontal: 20, borderRadius: 24, backgroundColor: palette.surface }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "#FBEDEC", alignItems: "center", justifyContent: "center" }}>
        <Icon name="alert" size={28} color={palette.danger} />
      </View>
      <T variant="headline" weight="700" style={{ textAlign: "center" }}>{title ?? t("m.states.errorTitle")}</T>
      <T variant="callout" muted style={{ textAlign: "center" }}>{body ?? t("m.states.errorBody")}</T>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {onRetry ? (
          <PressableScale onPress={onRetry} accessibilityRole="button" accessibilityLabel={t("m.common.retry")} style={{ minHeight: 46, paddingHorizontal: 18, borderRadius: 16, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" }}>
            <T variant="subhead" weight="700" color="#FFFFFF">{t("m.common.retry")}</T>
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={() => void Linking.openURL("tel:1242")}
          accessibilityRole="button"
          accessibilityLabel={t("m.states.call1242")}
          style={{ minHeight: 46, paddingHorizontal: 18, borderRadius: 16, backgroundColor: "#F2F2F5", alignItems: "center", justifyContent: "center" }}
        >
          <T variant="subhead" weight="700">{t("m.states.call1242")}</T>
        </PressableScale>
      </View>
    </View>
  );
}

/** Skeleton while loading, ErrorState (with retry) on failure, children otherwise. */
export function QueryState<D>({
  query,
  children,
  skeleton,
  empty,
}: {
  query: UseQueryResult<D>;
  children: (data: D) => ReactNode;
  skeleton?: ReactNode;
  /** Return an element to render instead of children when data is "empty". */
  empty?: (data: D) => ReactNode | null;
}) {
  if (query.data !== undefined) {
    const emptyView = empty?.(query.data) ?? null;
    return <>{emptyView ?? children(query.data)}</>;
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  return <>{skeleton ?? <SkeletonList />}</>;
}

/** Route helper: open the catalog tab. */
export function useOpenCatalog(): () => void {
  const router = useRouter();
  return () => router.navigate("/catalog");
}
