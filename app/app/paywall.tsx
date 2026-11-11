import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useConfig } from "../src/query/hooks";
import { useBillingMe, useBillingPlans } from "../src/query/hooks";
import { useLang } from "../src/i18n/useLang";
import { Button, Card, T } from "../src/ui/primitives";
import { QueryState } from "../src/ui/QueryState";
import { Screen } from "../src/ui/Screen";

/** Shown on a 402 `plan_limit` (and from Profile) only when `/config/` reports billing_enabled. */
export default function Paywall() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const config = useConfig();
  const plans = useBillingPlans(lang);
  const me = useBillingMe();

  return (
    <Screen>
      <T variant="title1">{t("m.paywall.title")}</T>
      {config.data && !config.data.billing_enabled ? <T muted>{t("m.paywall.disabled")}</T> : null}
      {me.data?.limit != null ? <T>{t("m.paywall.limit", { limit: me.data.limit })}</T> : null}
      <QueryState query={plans}>
        {({ plans: items }) =>
          items.map((plan) => (
            <Card key={plan.code}>
              <T variant="headline">{plan.name}</T>
              <T variant="footnote" muted>
                {plan.price_uzs ?? "-"} UZS / {plan.period_days}
              </T>
            </Card>
          ))
        }
      </QueryState>
      <Button tone="plain" label={t("m.common.close")} onPress={() => router.back()} />
    </Screen>
  );
}
