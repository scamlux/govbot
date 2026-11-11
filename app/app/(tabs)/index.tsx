import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { categoryStyle } from "../../src/domain/categories";
import { greetingKey } from "../../src/domain/dates";
import { useAuth } from "../../src/auth/AuthProvider";
import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { useCategories, useConfig } from "../../src/query/hooks";
import { useActiveCases, type CaseItem } from "../../src/query/cases";
import { useA11y } from "../../src/theme/a11y";
import { families } from "../../src/theme/tokens";
import { GirihPattern } from "../../src/ui/Girih";
import { Icon } from "../../src/ui/icons";
import { LargeTitleScreen } from "../../src/ui/LargeTitleScreen";
import { useRise } from "../../src/ui/motion";
import { PressableScale } from "../../src/ui/PressableScale";
import { ProgressRing } from "../../src/ui/ProgressRing";
import { Avatar, Pill, SectionTitle, T } from "../../src/ui/primitives";
import { Skeleton } from "../../src/ui/Skeleton";
import { EmptyState, OfflineBanner } from "../../src/ui/States";

const MAX_TOPICS = 6;

function Hero() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette, appTextScale } = useA11y();
  const [text, setText] = useState("");

  const ask = () => {
    const question = text.trim();
    void haptics.light();
    router.push({ pathname: "/chat/[id]", params: { id: "new", ...(question ? { prefill: question, autoSend: "1" } : {}) } });
    setText("");
  };

  return (
    <View>
      <View
        style={{
          borderRadius: 28,
          padding: 20,
          gap: 14,
          overflow: "hidden",
          backgroundColor: palette.accent,
          shadowColor: palette.accent,
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 20 },
          elevation: 8,
        }}
      >
        <GirihPattern id="homeHero" />
        <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" }}>
          <T size={12} weight="700" ls={0.04} color="#FFFFFF">{t("m.home.aiBadge")}</T>
        </View>
        <T size={24} weight="800" ls={-0.02} color="#FFFFFF" accessibilityRole="header">{t("m.home.heroTitle")}</T>
        <View style={{ minHeight: 52, borderRadius: 18, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 6, gap: 6 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={ask}
            placeholder={t("m.home.example")}
            placeholderTextColor={palette.muted}
            accessibilityLabel={t("m.chat.askPlaceholder")}
            returnKeyType="send"
            style={{ flex: 1, minWidth: 0, fontSize: 16 * appTextScale, color: palette.ink, paddingVertical: 10 }}
          />
          <PressableScale
            onPress={() => router.push("/voice")}
            accessibilityRole="button"
            accessibilityLabel={t("m.chat.voiceInput")}
            style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "#F2F2F5", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="mic" size={18} color={palette.ink} />
          </PressableScale>
          <PressableScale
            onPress={ask}
            accessibilityRole="button"
            accessibilityLabel={t("common.send")}
            style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="arrowUp" size={18} color="#FFFFFF" strokeWidth={2.4} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function CaseCard({ item, flex }: { item: CaseItem; flex: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useA11y();
  const family = families[categoryStyle(item.category).family];
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => router.push({ pathname: "/scenario/[slug]", params: { slug: item.slug } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${t("m.cases.progress", { done: item.done, total: item.total })}`}
      style={{ flex, minWidth: 0 }}
    >
      <View style={{ gap: 12, padding: 16, borderRadius: 24, backgroundColor: palette.surface, shadowColor: "#1D1D1F", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <ProgressRing done={item.done} total={item.total} label={`${item.done}/${item.total}`} color={family.solid} />
          {item.daysLeft !== null ? <Pill label={item.daysLeft === 0 ? t("m.home.today") : t("m.home.daysLeft", { count: item.daysLeft })} bg={palette.warnTint} fg={families.gold.ink} /> : null}
        </View>
        <T variant="callout" weight="700" numberOfLines={2}>{item.title}</T>
        {item.nextItem ? <T variant="footnote" muted numberOfLines={2}>{t("m.home.nextItem", { item: item.nextItem })}</T> : null}
      </View>
    </PressableScale>
  );
}

function Ongoing() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, loading } = useActiveCases();
  const shown = items.slice(0, 2);
  return (
    <>
      <SectionTitle action={t("m.home.all")} onAction={() => router.navigate("/cases")}>{t("m.home.ongoing")}</SectionTitle>
      {loading && shown.length === 0 ? (
        <Skeleton height={130} radius={24} />
      ) : shown.length === 0 ? (
        <EmptyState icon="cases" title={t("m.cases.emptyTitle")} body={t("m.home.noOngoing")} cta={t("m.cases.openCatalog")} onCta={() => router.navigate("/catalog")} />
      ) : (
        <View style={{ flexDirection: "row", gap: 12 }}>
          {shown.map((item, i) => (
            <CaseCard key={item.slug} item={item} flex={i === 0 && shown.length > 1 ? 1.25 : 1} />
          ))}
        </View>
      )}
    </>
  );
}

function Topics() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { palette } = useA11y();
  const categories = useCategories(lang);
  const items = (categories.data ?? []).slice(0, MAX_TOPICS);
  return (
    <>
      <SectionTitle>{t("m.home.topics")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {categories.data === undefined
          ? Array.from({ length: MAX_TOPICS }, (_, i) => (
              <View key={i} style={{ width: "31.5%" }}>
                <Skeleton height={104} radius={20} />
              </View>
            ))
          : items.map((c) => {
              const style = categoryStyle(c.slug);
              const family = families[style.family];
              return (
                <PressableScale
                  key={c.slug}
                  scaleTo={0.97}
                  haptic="selection"
                  onPress={() => router.navigate({ pathname: "/catalog", params: { category: c.slug } })}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  style={{ width: "31.5%" }}
                >
                  <View style={{ alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, backgroundColor: palette.surface, minHeight: 104 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: family.tint, alignItems: "center", justifyContent: "center" }}>
                      <Icon name={style.icon} size={22} color={family.ink} strokeWidth={1.9} />
                    </View>
                    <T size={13} weight="600" numberOfLines={2} style={{ textAlign: "center" }}>{c.name}</T>
                  </View>
                </PressableScale>
              );
            })}
      </View>
    </>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const config = useConfig();
  const lang = useLang();
  const categories = useCategories(lang);
  const cases = useActiveCases();
  const rise1 = useRise(0);
  const rise2 = useRise(80);
  const rise3 = useRise(160);

  const name = user?.display_name || user?.full_name || "";
  const greeting = name ? `${t(`m.home.${greetingKey()}`)}, ${name.split(" ")[0]}` : t("m.home.hello");
  const aiMode = config.data?.ai_mode;
  const aiNote = aiMode && aiMode !== "live" ? t(`m.home.aiMode.${aiMode}`) : null;

  return (
    <LargeTitleScreen
      title={t("m.home.title")}
      onRefresh={() => Promise.all([categories.refetch(), config.refetch(), cases.refetch()])}
      top={<OfflineBanner />}
      largeTitle={
        <View>
          <T variant="subhead" muted>{greeting}</T>
          <T size={32} weight="800" ls={-0.03} style={{ marginTop: 2 }} accessibilityRole="header">{t("m.home.title")}</T>
        </View>
      }
      headerRight={
        <PressableScale onPress={() => router.navigate("/profile")} accessibilityRole="button" accessibilityLabel={t("m.tabs.profile")} haptic="selection">
          <Avatar name={name || "G"} />
        </PressableScale>
      }
    >
      {aiNote ? (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "#FDF6E6" }}>
          <Icon name="info" size={18} color="#7A5413" />
          <View style={{ flex: 1 }}>
            <T variant="footnote" color="#7A5413">{aiNote}</T>
          </View>
        </View>
      ) : null}
      <Animated.View entering={rise1}><Hero /></Animated.View>
      <Animated.View entering={rise2} style={{ gap: 14 }}><Ongoing /></Animated.View>
      <Animated.View entering={rise3} style={{ gap: 14 }}><Topics /></Animated.View>
    </LargeTitleScreen>
  );
}
