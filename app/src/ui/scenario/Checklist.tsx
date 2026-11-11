import { useRef, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { haptics } from "../../native/haptics";
import { useChecklist } from "../../state/checklist";
import { useA11y } from "../../theme/a11y";
import { families, type FamilyName } from "../../theme/tokens";
import { GirihBurst } from "../Girih";
import { PressableScale } from "../PressableScale";
import { CheckBox, ProgressRing } from "../ProgressRing";
import { T } from "../primitives";

/** Persisted document checklist with animated checks, progress ring and a gold burst at 100%. */
export function Checklist({ slug, items, family }: { slug: string; items: readonly string[]; family: FamilyName }) {
  const { t } = useTranslation();
  const { palette } = useA11y();
  const ticked = useChecklist((s) => s.progress[`checklist:${slug}`]) ?? [];
  const toggle = useChecklist((s) => s.toggle);
  const [burst, setBurst] = useState(0);
  const celebrated = useRef(false);

  if (items.length === 0) return null;
  const done = items.filter((i) => ticked.includes(i)).length;
  const complete = done === items.length;
  if (!complete) celebrated.current = false;

  const onToggle = (item: string) => {
    const next = toggle(slug, item);
    const nowDone = items.filter((i) => next.includes(i)).length;
    if (next.includes(item)) void haptics.success();
    else void haptics.selection();
    if (nowDone === items.length && !celebrated.current) {
      celebrated.current = true;
      setBurst((n) => n + 1);
    }
  };

  return (
    <View style={{ borderRadius: 22, backgroundColor: palette.surface, padding: 16, gap: 6, overflow: "visible" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="headline" weight="800">{t("m.scenario.documents")}</T>
          <T variant="footnote" muted>{complete ? t("m.scenario.checklistDone") : t("m.cases.progress", { done, total: items.length })}</T>
        </View>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <GirihBurst play={burst > 0} key={burst} size={110} />
          <ProgressRing done={done} total={items.length} size={56} label={`${done}/${items.length}`} color={complete ? families.gold.solid : families[family].solid} />
        </View>
      </View>
      {items.map((item) => {
        const checked = ticked.includes(item);
        return (
          <PressableScale
            key={item}
            scaleTo={0.99}
            haptic="none"
            onPress={() => onToggle(item)}
            accessibilityRole="button"
            accessibilityState={{ checked }}
            accessibilityLabel={item}
          >
            <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
              <CheckBox checked={checked} />
              <View style={{ flex: 1 }}>
                <T variant="body" color={checked ? palette.muted : palette.ink} style={checked ? { textDecorationLine: "line-through" } : undefined}>{item}</T>
              </View>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
