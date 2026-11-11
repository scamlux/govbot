import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import type { Audience, Category, ScenarioSummary } from "../../src/api/types";
import { categoryStyle } from "../../src/domain/categories";
import { useDebounce } from "../../src/hooks/useDebounce";
import { useLang } from "../../src/i18n/useLang";
import { useCategories, useScenarios } from "../../src/query/hooks";
import { useA11y } from "../../src/theme/a11y";
import { families } from "../../src/theme/tokens";
import { Icon } from "../../src/ui/icons";
import { LargeTitleScreen } from "../../src/ui/LargeTitleScreen";
import { PressableScale } from "../../src/ui/PressableScale";
import { Chip, Pill, SearchField, T } from "../../src/ui/primitives";
import { Sheet } from "../../src/ui/Sheet";
import { SkeletonList } from "../../src/ui/Skeleton";
import { EmptyState, ErrorState, OfflineBanner } from "../../src/ui/States";

const SEARCH_DEBOUNCE_MS = 300;
const AUDIENCES: (Audience | "all")[] = ["all", "citizen", "resident", "tourist"];
const STAGGER_MS = 40;
const MAX_STAGGER = 8;

function ScenarioCard({ item, index, categoryName }: { item: ScenarioSummary; index: number; categoryName?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useA11y();
  const style = categoryStyle(item.category);
  const family = families[style.family];
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, MAX_STAGGER) * STAGGER_MS).duration(260)}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => router.push({ pathname: "/scenario/[slug]", params: { slug: item.slug, title: item.title, category: item.category } })}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={{ flexDirection: "row", gap: 14, padding: 16, borderRadius: 24, backgroundColor: palette.surface, shadowColor: "#1D1D1F", shadowOpacity: 0.04, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 1 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: family.tint, alignItems: "center", justifyContent: "center" }}>
            <Icon name={style.icon} size={24} color={family.ink} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <T variant="headline" weight="700" numberOfLines={2}>{item.title}</T>
            <T variant="subhead" muted numberOfLines={2}>{item.excerpt}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {categoryName ? <Pill label={categoryName} bg="#F2F2F5" fg="#3A3A3C" /> : null}
              {item.verified_at ? <Pill label={t("m.scenario.verifiedShort")} bg={palette.accentTint} fg={palette.accentPressed} /> : null}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function Catalog() {
  const { t } = useTranslation();
  const lang = useLang();
  const { palette } = useA11y();
  const params = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setCategory(params.category || undefined);
  }, [params.category]);

  const categories = useCategories(lang);
  const scenarios = useScenarios(lang, { category, search: search || undefined, audience: audience === "all" ? undefined : audience });
  const total = useMemo(() => (categories.data ?? []).reduce((sum, c: Category) => sum + c.scenario_count, 0), [categories.data]);
  const names = useMemo(() => Object.fromEntries((categories.data ?? []).map((c) => [c.slug, c.name])), [categories.data]);

  const audienceLabel = t(`m.catalog.audience.${audience}`);

  return (
    <>
      <LargeTitleScreen
        title={t("m.catalog.title")}
        onRefresh={() => Promise.all([categories.refetch(), scenarios.refetch()])}
        top={<OfflineBanner />}
        headerRight={
          <PressableScale
            haptic="selection"
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t("m.catalog.audienceTitle")}: ${audienceLabel}`}
            style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}
          >
            <T variant="subhead" weight="600">{audienceLabel}</T>
            <Icon name="chevronDown" size={14} color={palette.ink} />
          </PressableScale>
        }
      >
        <SearchField value={query} onChangeText={setQuery} placeholder={t("m.catalog.searchPlaceholder", { count: total || 35 })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingHorizontal: 16, flexGrow: 0 }}>
          <Chip label={t("m.catalog.all")} selected={!category} onPress={() => setCategory(undefined)} />
          {(categories.data ?? []).map((c) => (
            <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? undefined : c.slug)} />
          ))}
        </ScrollView>

        {scenarios.isError && scenarios.data === undefined ? (
          <ErrorState onRetry={() => void scenarios.refetch()} />
        ) : scenarios.data === undefined ? (
          <SkeletonList count={5} />
        ) : scenarios.data.length === 0 ? (
          <EmptyState icon="search" title={t("m.catalog.noResults")} body={t("m.catalog.noResultsBody")} cta={t("m.catalog.all")} onCta={() => { setQuery(""); setCategory(undefined); setAudience("all"); }} />
        ) : (
          <View style={{ gap: 12 }}>
            {scenarios.data.map((item, i) => (
              <ScenarioCard key={item.slug} item={item} index={i} categoryName={names[item.category]} />
            ))}
          </View>
        )}
      </LargeTitleScreen>

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} detents={[0.5]} label={t("m.catalog.audienceTitle")}>
        <T variant="title2" weight="800" ls={-0.02} style={{ marginTop: 6, marginBottom: 12 }}>{t("m.catalog.audienceTitle")}</T>
        <View style={{ gap: 8 }}>
          {AUDIENCES.map((value) => {
            const selected = value === audience;
            return (
              <PressableScale
                key={value}
                haptic="selection"
                onPress={() => {
                  setAudience(value);
                  setFilterOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={t(`m.catalog.audience.${value}`)}
                accessibilityState={{ selected }}
              >
                <View style={{ minHeight: 56, borderRadius: 18, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: selected ? palette.accentTint : "#F2F2F5" }}>
                  <T variant="body" weight={selected ? "700" : "500"} color={selected ? palette.accentPressed : palette.ink}>{t(`m.catalog.audience.${value}`)}</T>
                  {selected ? <Icon name="check" size={20} color={palette.accentPressed} strokeWidth={2.6} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
