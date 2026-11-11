import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { categoryStyle } from "../../src/domain/categories";
import { formatDate } from "../../src/domain/dates";
import { useLang } from "../../src/i18n/useLang";
import { hostOf, openInApp } from "../../src/native/browser";
import { shareText } from "../../src/native/share";
import { useCategories, useScenario } from "../../src/query/hooks";
import { useA11y } from "../../src/theme/a11y";
import { Icon } from "../../src/ui/icons";
import { Markdown } from "../../src/ui/Markdown";
import { useRise } from "../../src/ui/motion";
import { PressableScale } from "../../src/ui/PressableScale";
import { Button, T } from "../../src/ui/primitives";
import { Checklist } from "../../src/ui/scenario/Checklist";
import { ScenarioHero } from "../../src/ui/scenario/Hero";
import { ReminderRow } from "../../src/ui/scenario/ReminderRow";
import { Skeleton } from "../../src/ui/Skeleton";
import { ErrorState, OfflineBanner } from "../../src/ui/States";

const WEB_BASE = "https://govbot-web.vercel.app";

export default function ScenarioScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useA11y();
  const params = useLocalSearchParams<{ slug: string; title?: string; category?: string }>();
  const slug = String(params.slug);
  const scenario = useScenario(lang, slug);
  const categories = useCategories(lang);
  const rise = useRise(120);
  const data = scenario.data;

  const categorySlug = data?.category.slug ?? params.category;
  const style = categoryStyle(categorySlug);
  const title = data?.title ?? params.title ?? "";
  const categoryName = data?.category.name ?? categories.data?.find((c) => c.slug === categorySlug)?.name;
  const badges = [
    data?.verified_at ? t("m.scenario.verified", { date: formatDate(data.verified_at, lang) }) : null,
    data?.source_url ? hostOf(data.source_url) : null,
  ].filter((b): b is string => Boolean(b));

  const share = () => void shareText(`${title}\n${WEB_BASE}/scenarios/${slug}`, title).catch(() => undefined);
  const askAi = () =>
    router.push({ pathname: "/chat/[id]", params: { id: "new", prefill: t("m.scenario.askPrefill", { title }) } });

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScenarioHero title={title} eyebrow={categoryName} family={style.family} badges={badges} />
        <Animated.View entering={rise} style={{ marginTop: -18, paddingHorizontal: 16, gap: 12 }}>
          <View style={{ height: 18, marginHorizontal: -16, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.bg, marginBottom: -6 }} />
          <OfflineBanner />
          {scenario.isError && !data ? (
            <ErrorState title={t("m.scenario.notFound")} onRetry={() => void scenario.refetch()} />
          ) : !data ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={72} radius={22} />
              <Skeleton height={180} radius={22} />
              <Skeleton height={140} radius={22} />
            </View>
          ) : (
            <>
              <ReminderRow slug={slug} title={data.title} />
              <Checklist slug={slug} items={data.checklist} family={style.family} />
              <View style={{ borderRadius: 22, backgroundColor: palette.surface, padding: 16 }}>
                <Markdown>{data.body}</Markdown>
              </View>
              {data.source_url ? (
                <PressableScale
                  onPress={() => void openInApp(data.source_url, palette.accent)}
                  accessibilityRole="link"
                  accessibilityLabel={`${t("m.scenario.source")}: ${hostOf(data.source_url)}`}
                >
                  <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: palette.accentTint }}>
                    <Icon name="link" size={20} color={palette.accentPressed} />
                    <View style={{ flex: 1 }}>
                      <T variant="callout" weight="700" color={palette.accentPressed}>{t("m.scenario.source")}</T>
                      <T variant="footnote" muted numberOfLines={1}>{hostOf(data.source_url)}</T>
                    </View>
                    <Icon name="chevronRight" size={18} color={palette.accentPressed} />
                  </View>
                </PressableScale>
              ) : null}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.06)" }}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: "row", gap: 10, paddingTop: 14, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 12) + 8, backgroundColor: "rgba(245,246,248,0.86)" }}>
          <Button tone="plain" icon="share" label={t("m.scenario.share")} onPress={share} style={{ paddingHorizontal: 18 }} />
          <Button icon="sparkle" label={t("m.scenario.askAi")} onPress={askAi} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}
