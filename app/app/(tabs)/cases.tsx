import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { dayAndMonth } from "../../src/domain/dates";
import { useLang } from "../../src/i18n/useLang";
import { listReminders } from "../../src/native/notifications";
import { useActiveCases } from "../../src/query/cases";
import { useReminders } from "../../src/state/reminders";
import { useA11y } from "../../src/theme/a11y";
import { families } from "../../src/theme/tokens";
import { categoryStyle } from "../../src/domain/categories";
import { Icon } from "../../src/ui/icons";
import { LargeTitleScreen } from "../../src/ui/LargeTitleScreen";
import { PressableScale } from "../../src/ui/PressableScale";
import { ProgressRing } from "../../src/ui/ProgressRing";
import { Group, SectionTitle, T } from "../../src/ui/primitives";
import { Skeleton } from "../../src/ui/Skeleton";
import { EmptyState, OfflineBanner } from "../../src/ui/States";

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <T variant="subhead" color="#3A3A3C">{text}</T>
    </View>
  );
}

export default function Cases() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { palette } = useA11y();
  const { items, loading, refetch } = useActiveCases();
  const reminders = useReminders((s) => s.reminders);
  const prune = useReminders((s) => s.pruneExpired);

  useFocusEffect(
    useCallback(() => {
      prune();
      listReminders().catch(() => undefined);
    }, [prune]),
  );

  const totals = useMemo(() => items.reduce((acc, c) => ({ done: acc.done + c.done, total: acc.total + c.total }), { done: 0, total: 0 }), [items]);
  const upcoming = reminders.filter((r) => new Date(r.fireAt) > new Date()).slice(0, 6);
  const open = (slug: string) => router.push({ pathname: "/scenario/[slug]", params: { slug } });
  const empty = items.length === 0 && upcoming.length === 0;

  return (
    <LargeTitleScreen title={t("m.cases.title")} onRefresh={() => refetch()} top={<OfflineBanner />}>
      {loading && items.length === 0 ? (
        <Skeleton height={120} radius={26} />
      ) : empty ? (
        <EmptyState icon="cases" title={t("m.cases.emptyTitle")} body={t("m.cases.emptyBody")} cta={t("m.cases.openCatalog")} onCta={() => router.navigate("/catalog")} />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18, padding: 18, borderRadius: 26, backgroundColor: palette.surface }}>
            <ProgressRing done={totals.done} total={totals.total} size={96} stroke={4.5} label={`${totals.total ? Math.round((totals.done / totals.total) * 100) : 0}%`} />
            <View style={{ flex: 1, gap: 6 }}>
              <T size={20} weight="800" ls={-0.02}>{t("m.cases.activeCount", { count: items.length })}</T>
              <Legend color={palette.accent} text={t("m.cases.docsReady", { done: totals.done, total: totals.total })} />
              <Legend color={palette.gold} text={t("m.cases.remindersOn", { count: upcoming.length })} />
            </View>
          </View>

          <SectionTitle>{t("m.cases.upcoming")}</SectionTitle>
          {upcoming.length === 0 ? (
            <T variant="callout" muted style={{ marginHorizontal: 4 }}>{t("m.cases.noDeadlines")}</T>
          ) : (
            <View style={{ gap: 10 }}>
              {upcoming.map((r, index) => {
                const { day, month } = dayAndMonth(r.fireAt, lang);
                const first = index === 0;
                return (
                  <PressableScale key={r.id} scaleTo={0.98} onPress={() => open(r.slug)} accessibilityRole="button" accessibilityLabel={`${r.title}, ${day} ${month}`}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: palette.surface }}>
                      <View style={{ width: 56, paddingVertical: 8, borderRadius: 16, alignItems: "center", backgroundColor: first ? palette.accent : "#F2F2F5" }}>
                        <T size={22} weight="800" color={first ? "#FFFFFF" : palette.ink} style={{ lineHeight: 24 }}>{day}</T>
                        <T size={11} weight="700" color={first ? "#FFFFFF" : palette.ink} style={{ marginTop: 3 }}>{month}</T>
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <T variant="callout" weight="700" numberOfLines={2}>{r.title}</T>
                        <T variant="subhead" muted>{t("m.scenario.reminderTitle")} · 09:00</T>
                      </View>
                      <Icon name="chevronRight" size={18} color={palette.muted} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          )}

          <SectionTitle>{t("m.cases.active")}</SectionTitle>
          <Group>
            {items.map((c, index) => {
              const pct = c.total ? c.done / c.total : 0;
              const family = families[categoryStyle(c.category).family];
              return (
                <PressableScale key={c.slug} scaleTo={0.99} haptic="selection" onPress={() => open(c.slug)} accessibilityRole="button" accessibilityLabel={`${c.title}, ${c.done}/${c.total}`} style={{ backgroundColor: palette.surface }}>
                  <View style={{ gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: index === items.length - 1 ? 0 : 1, borderBottomColor: "#F0F0F3" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T variant="callout" weight="700" numberOfLines={1}>{c.title}</T>
                      </View>
                      <T variant="subhead" weight="700" color={palette.accentPressed}>{c.done}/{c.total}</T>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.accentTint, overflow: "hidden" }}>
                      <View style={{ width: `${Math.round(pct * 100)}%`, height: 6, borderRadius: 3, backgroundColor: family.solid }} />
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </Group>
        </>
      )}
    </LargeTitleScreen>
  );
}
