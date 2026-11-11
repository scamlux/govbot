import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";

import { formatDate } from "../../domain/dates";
import { useLang } from "../../i18n/useLang";
import { haptics } from "../../native/haptics";
import { cancelReminder, scheduleReminder } from "../../native/notifications";
import { useReminders } from "../../state/reminders";
import { useA11y } from "../../theme/a11y";
import { families } from "../../theme/tokens";
import { Icon } from "../icons";
import { Button, T, Toggle } from "../primitives";
import { Sheet } from "../Sheet";

const DAY_MS = 86_400_000;

/** "Eslatma" row: toggle on opens a date picker, schedules a 09:00 local notification; off cancels it. */
export function ReminderRow({ slug, title }: { slug: string; title: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const { palette } = useA11y();
  const reminders = useReminders((s) => s.reminders);
  const current = useMemo(() => reminders.filter((r) => r.slug === slug && new Date(r.fireAt) > new Date())[0], [reminders, slug]);
  const [message, setMessage] = useState<string | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDate, setIosDate] = useState(() => new Date(Date.now() + DAY_MS));

  const commit = async (day: Date) => {
    const result = await scheduleReminder({ slug, title, body: t("m.scenario.reminderBody"), day });
    if (result.ok) {
      void haptics.success();
      setMessage(t("m.scenario.reminderSet", { date: formatDate(day, lang) }));
    } else {
      void haptics.warning();
      setMessage(result.reason === "denied" ? t("m.scenario.notificationsDenied") : t("m.scenario.reminderPast"));
    }
  };

  const pick = () => {
    const minimumDate = new Date(Date.now() + DAY_MS / 2);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: iosDate,
        mode: "date",
        minimumDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set" && date) void commit(date);
        },
      });
    } else {
      setIosOpen(true);
    }
  };

  const onToggle = (on: boolean) => {
    if (on) pick();
    else if (current) {
      void cancelReminder(current.id);
      setMessage(null);
    }
  };

  const gold = families.gold;
  return (
    <>
      <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 22, backgroundColor: palette.surface }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: gold.tint, alignItems: "center", justifyContent: "center" }}>
          <Icon name="bell" size={22} color={gold.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="headline" weight="700">{t("m.scenario.reminderTitle")}</T>
          <T variant="subhead" muted>{current ? t("m.scenario.reminderAt", { date: formatDate(current.fireAt, lang) }) : t("m.scenario.reminderOff")}</T>
        </View>
        <Toggle value={Boolean(current)} onChange={onToggle} label={t("m.scenario.remind")} />
      </View>
      {message ? (
        <T variant="footnote" muted accessibilityLiveRegion="polite" style={{ marginHorizontal: 6 }}>{message}</T>
      ) : null}
      <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} detents={[0.62]} label={t("m.scenario.remind")}>
        <View style={{ gap: 12, paddingTop: 8 }}>
          <T variant="title2" weight="800">{t("m.scenario.remind")}</T>
          <DateTimePicker value={iosDate} mode="date" display="inline" minimumDate={new Date()} onChange={(_e, d) => d && setIosDate(d)} accentColor={palette.accent} />
          <Button
            label={t("m.scenario.remind")}
            onPress={() => {
              setIosOpen(false);
              void commit(iosDate);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}
