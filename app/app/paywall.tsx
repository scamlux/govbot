import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { billingApi } from "../src/api/endpoints";
import type { PaymentProvider, Plan } from "../src/api/types";
import { useAuth } from "../src/auth/AuthProvider";
import { checkoutUrl, formatPrice, paywallMode, purchasablePlans } from "../src/domain/paywall";
import { useLang } from "../src/i18n/useLang";
import { haptics } from "../src/native/haptics";
import { openInApp } from "../src/native/browser";
import { useBillingMe, useBillingPlans, useConfig } from "../src/query/hooks";
import { useA11y } from "../src/theme/a11y";
import { GirihMark } from "../src/ui/Girih";
import { Icon } from "../src/ui/icons";
import { PressableScale } from "../src/ui/PressableScale";
import { Button, IconButton, Pill, T } from "../src/ui/primitives";
import { Skeleton } from "../src/ui/Skeleton";

const PROVIDERS: { id: PaymentProvider; label: string }[] = [
  { id: "payme", label: "Payme" },
  { id: "click", label: "Click" },
];

/** Paywall: reachable on a 402 plan_limit or from Profile when billing is enabled. Otherwise limit info only. */
export default function Paywall() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, reduceMotion } = useA11y();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ limit?: string }>();
  const config = useConfig();
  const mode = paywallMode(config.data?.billing_enabled);
  const plansQuery = useBillingPlans(lang);
  const me = useBillingMe();
  const [selected, setSelected] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("payme");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = params.limit ? Number(params.limit) : me.data?.limit ?? null;
  const plans: Plan[] = mode === "plans" ? purchasablePlans(plansQuery.data?.plans ?? []) : [];
  const chosen = plans.find((p) => p.code === selected) ?? plans[0];

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const checkout = async () => {
    if (!chosen) return;
    if (!user) {
      setError(t("m.paywall.signInFirst"));
      router.push("/auth");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = checkoutUrl(await billingApi.checkout({ plan: chosen.code, provider, lang }));
      if (!url) throw new Error("no url");
      void haptics.success();
      await openInApp(url, palette.accent);
    } catch {
      void haptics.warning();
      setError(t("m.paywall.checkoutFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={reduceMotion ? undefined : SlideInDown.springify().damping(22).stiffness(140)} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 190 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#0E5960", palette.accent, palette.bg]} locations={[0, 0.55, 1]} style={{ height: 300 + insets.top, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: insets.top }}>
          <View style={{ position: "absolute", top: insets.top + 8, right: 14 }}>
            <IconButton icon="close" label={t("m.common.close")} onPress={close} color="#FFFFFF" bg="rgba(255,255,255,0.2)" />
          </View>
          <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
            <GirihMark size={44} stroke={1.8} a="#FFFFFF" b="#E7C98A" />
          </View>
          <T size={26} weight="800" ls={-0.02} color="#FFFFFF" style={{ textAlign: "center", paddingHorizontal: 30 }} accessibilityRole="header">{t("m.paywall.limitTitle")}</T>
        </LinearGradient>

        <View style={{ gap: 12, paddingHorizontal: 16 }}>
          <T variant="subhead" color="#3A3A3C" style={{ textAlign: "center", marginHorizontal: 6 }}>
            {limit !== null && Number.isFinite(limit)
              ? mode === "plans"
                ? t("m.paywall.limitBody", { limit })
                : t("m.paywall.limit", { limit })
              : t("m.paywall.limitBodyNoNumber")}
          </T>
          {mode === "limit-only" ? <T variant="footnote" muted style={{ textAlign: "center" }}>{t("m.paywall.disabled")}</T> : null}

          {mode === "plans" && plansQuery.data === undefined ? <Skeleton height={80} radius={22} /> : null}
          {plans.map((plan, index) => {
            const on = plan.code === chosen?.code;
            return (
              <PressableScale
                key={plan.code}
                haptic="selection"
                scaleTo={0.98}
                onPress={() => setSelected(plan.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${plan.name}, ${formatPrice(plan.price_uzs ?? 0)}`}
              >
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 16, borderRadius: 22, backgroundColor: palette.surface, borderWidth: 2, borderColor: on ? palette.accent : "transparent", shadowColor: palette.accent, shadowOpacity: on ? 0.14 : 0, shadowRadius: 15, shadowOffset: { width: 0, height: 14 }, elevation: on ? 4 : 0 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? palette.accent : "#C7C7CC", alignItems: "center", justifyContent: "center" }}>
                    {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent }} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <T variant="headline" weight="800">{plan.name}</T>
                      {index === 0 ? <Pill label={t("m.paywall.popular")} bg={palette.accentTint} fg={palette.accentPressed} /> : null}
                    </View>
                    <T variant="subhead" color="#3A3A3C" numberOfLines={2}>
                      {plan.features.length ? plan.features.join(" · ") : plan.daily_question_limit ? t("m.paywall.perDay", { count: plan.daily_question_limit }) : t("m.paywall.unlimited")}
                    </T>
                  </View>
                  <T variant="callout" weight="700">{formatPrice(plan.price_uzs ?? 0)}</T>
                </View>
              </PressableScale>
            );
          })}
          {mode === "plans" && plansQuery.isError ? <T variant="footnote" style={{ color: palette.danger, textAlign: "center" }}>{t("m.common.error")}</T> : null}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, gap: 10, paddingTop: 14, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 12) + 14, backgroundColor: palette.bg }}>
        {mode === "plans" ? (
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
            {PROVIDERS.map((p) => {
              const on = p.id === provider;
              return (
                <PressableScale key={p.id} haptic="selection" onPress={() => setProvider(p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={p.label}>
                  <View style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? palette.ink : palette.surface, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    <T variant="footnote" weight="600" color={on ? "#FFFFFF" : "#3A3A3C"}>{p.label}</T>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        {error ? <T variant="footnote" style={{ color: palette.danger, textAlign: "center" }} accessibilityLiveRegion="polite">{error}</T> : null}
        {mode === "plans" && chosen ? (
          <Button tone="dark" label={t("m.paywall.pay", { plan: chosen.name, price: formatPrice(chosen.price_uzs ?? 0) })} onPress={() => void checkout()} loading={busy} />
        ) : null}
        <Button tone={mode === "plans" ? "plain" : "primary"} size="md" label={t("m.paywall.continueFree")} onPress={close} />
      </View>
    </Animated.View>
  );
}
