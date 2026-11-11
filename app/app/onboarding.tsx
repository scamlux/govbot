import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "../src/state/settings";
import { Button, T } from "../src/ui/primitives";
import { Screen } from "../src/ui/Screen";

const STEPS = ["step1", "step2", "step3"] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const [index, setIndex] = useState(0);
  const last = index === STEPS.length - 1;

  const next = () => {
    if (!last) return setIndex(index + 1);
    setOnboarded(true);
    router.replace("/");
  };

  return (
    <Screen>
      <T variant="largeTitle">{t("m.onboarding.title")}</T>
      <T>{t(`m.onboarding.${STEPS[index]}`)}</T>
      <Button label={t(last ? "m.onboarding.start" : "m.onboarding.next")} onPress={next} />
    </Screen>
  );
}
