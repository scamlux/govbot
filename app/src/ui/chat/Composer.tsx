import { LinearGradient } from "expo-linear-gradient";
import { TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useA11y } from "../../theme/a11y";
import { Icon } from "../icons";
import { PressableScale } from "../PressableScale";
import { Chip } from "../primitives";

export interface ComposerProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  onVoice: () => void;
  streaming: boolean;
  plain: boolean;
  onTogglePlain: () => void;
}

/** Floating input pill with "Oddiy til" toggle, voice mode and send / stop. */
export function Composer({ value, onChange, onSend, onStop, onVoice, streaming, plain, onTogglePlain }: ComposerProps) {
  const { t } = useTranslation();
  const { palette, appTextScale } = useA11y();
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0;
  return (
    <LinearGradient colors={["rgba(245,246,248,0)", palette.bg]} locations={[0, 0.3]} style={{ paddingTop: 18, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 10) + 6, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip label={t("m.chat.simpleLanguage")} icon="simple" tone={plain ? "tint" : "default"} onPress={onTogglePlain} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingVertical: 6, paddingLeft: 18, paddingRight: 6, borderRadius: 26, backgroundColor: palette.surface, shadowColor: "#1D1D1F", shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          placeholder={t("m.chat.askPlaceholder")}
          placeholderTextColor={palette.muted}
          accessibilityLabel={t("m.chat.askPlaceholder")}
          style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, fontSize: 17 * appTextScale, color: palette.ink, paddingVertical: 10, textAlignVertical: "center" }}
        />
        <PressableScale onPress={onVoice} accessibilityRole="button" accessibilityLabel={t("m.chat.voiceInput")} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "#F2F2F5", alignItems: "center", justifyContent: "center" }}>
          <Icon name="mic" size={20} color={palette.ink} />
        </PressableScale>
        {streaming ? (
          <PressableScale onPress={onStop} accessibilityRole="button" accessibilityLabel={t("m.chat.stop")} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: "#FFFFFF" }} />
          </PressableScale>
        ) : (
          <PressableScale onPress={onSend} disabled={!canSend} accessibilityRole="button" accessibilityLabel={t("common.send")} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: canSend ? palette.ink : "#C7C7CC", alignItems: "center", justifyContent: "center" }}>
            <Icon name="arrowUp" size={20} color="#FFFFFF" strokeWidth={2.4} />
          </PressableScale>
        )}
      </View>
    </LinearGradient>
  );
}
