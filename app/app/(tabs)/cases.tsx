import { Link } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { listReminders } from "../../src/native/notifications";
import { useLang } from "../../src/i18n/useLang";
import { useScenario } from "../../src/query/hooks";
import { checklistKey, useChecklist } from "../../src/state/checklist";
import { useReminders } from "../../src/state/reminders";
import { Card, T } from "../../src/ui/primitives";
import { Screen } from "../../src/ui/Screen";

function CaseRow({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const scenario = useScenario(lang, slug); // served from the offline cache when possible
  const ticked = useChecklist((s) => s.progress[checklistKey(slug)] ?? []);
  const items = scenario.data?.checklist ?? [];
  const done = items.filter((item) => ticked.includes(item)).length;
  return (
    <Link href={{ pathname: "/scenario/[slug]", params: { slug } }}>
      <Card>
        <T variant="headline">{scenario.data?.title ?? slug}</T>
        <T variant="footnote" muted>
          {t("m.cases.progress", { done: scenario.data ? done : ticked.length, total: items.length })}
        </T>
      </Card>
    </Link>
  );
}

export default function Cases() {
  const { t } = useTranslation();
  const progress = useChecklist((s) => s.progress);
  const reminders = useReminders((s) => s.reminders);
  const slugs = Object.entries(progress)
    .filter(([, ticked]) => ticked.length > 0)
    .map(([key]) => key.slice("checklist:".length));

  useEffect(() => {
    void listReminders().catch(() => undefined);
  }, []);

  return (
    <Screen>
      <T variant="largeTitle">{t("m.cases.title")}</T>
      {slugs.length === 0 ? <T muted>{t("m.cases.empty")}</T> : slugs.map((slug) => <CaseRow key={slug} slug={slug} />)}
      <T variant="title2">{t("m.cases.reminders")}</T>
      {reminders.length === 0 ? (
        <T muted>{t("m.cases.noReminders")}</T>
      ) : (
        reminders.map((reminder) => (
          <Card key={reminder.id}>
            <T variant="headline">{reminder.title}</T>
            <T variant="footnote" muted>
              {new Date(reminder.fireAt).toLocaleString()}
            </T>
          </Card>
        ))
      )}
    </Screen>
  );
}
