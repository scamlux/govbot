import Markdown from "@ronradtke/react-native-markdown-display";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { scheduleReminder } from "../../src/native/notifications";
import { useScenario } from "../../src/query/hooks";
import { useChecklist, checklistKey } from "../../src/state/checklist";
import { useA11y } from "../../src/theme/a11y";
import { Button, T } from "../../src/ui/primitives";
import { QueryState } from "../../src/ui/QueryState";
import { Screen } from "../../src/ui/Screen";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ScenarioScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { palette } = useA11y();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const scenario = useScenario(lang, slug);
  const ticked = useChecklist((s) => s.progress[checklistKey(slug)] ?? []);
  const toggle = useChecklist((s) => s.toggle);
  const [note, setNote] = useState<string | null>(null);

  const remind = async (title: string) => {
    // Placeholder: tomorrow 09:00. A date picker arrives with the design spec.
    const day = new Date(Date.now() + DAY_MS);
    const result = await scheduleReminder({ slug, title, body: title, day });
    setNote(
      result.ok
        ? t("m.scenario.reminderSet", { date: day.toLocaleDateString() })
        : t("m.scenario.notificationsDenied"),
    );
  };

  return (
    <Screen>
      <QueryState query={scenario}>
        {(data) => (
          <>
            <T variant="title1">{data.title}</T>
            {data.verified_at ? <T variant="footnote" muted>{t("m.scenario.verified", { date: data.verified_at })}</T> : null}
            <Markdown style={{ body: { color: palette.ink, fontSize: 17, lineHeight: 24 } }}>{data.body}</Markdown>

            <T variant="title2">{t("m.scenario.documents")}</T>
            {data.checklist.length === 0 ? <T muted>{t("scenarios.documentsEmpty")}</T> : null}
            {data.checklist.map((item) => {
              const done = ticked.includes(item);
              return (
                <Pressable
                  key={item}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  onPress={() => {
                    toggle(slug, item);
                    void haptics.light();
                  }}
                >
                  <T style={{ textDecorationLine: done ? "line-through" : "none" }}>
                    {done ? "[x] " : "[ ] "}
                    {item}
                  </T>
                </Pressable>
              );
            })}
            {data.checklist.length > 0 ? (
              <T variant="footnote" muted>
                {t("scenarios.progress", {
                  done: data.checklist.filter((i) => ticked.includes(i)).length,
                  total: data.checklist.length,
                })}
              </T>
            ) : null}

            {data.source_url ? (
              <Button tone="plain" label={t("m.scenario.source")} onPress={() => void Linking.openURL(data.source_url)} />
            ) : null}
            <Button tone="plain" label={t("m.scenario.remind")} onPress={() => void remind(data.title)} />
            {note ? <T variant="footnote" muted>{note}</T> : null}
            <Button
              label={t("m.scenario.askAi")}
              onPress={() =>
                router.push({
                  pathname: "/chat/[id]",
                  params: { id: "new", prefill: t("scenarios.askPrefill", { title: data.title }) },
                })
              }
            />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
