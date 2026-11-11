import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Switch, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { authApi } from "../../src/api/endpoints";
import { useAuth } from "../../src/auth/AuthProvider";
import { HOTLINES, SUPPORTED_LANGS } from "../../src/config";
import { changeLanguage } from "../../src/i18n";
import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { shareText } from "../../src/native/share";
import { useSettings } from "../../src/state/settings";
import { useA11y } from "../../src/theme/a11y";
import { Button, Card, T } from "../../src/ui/primitives";
import { Screen } from "../../src/ui/Screen";

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <T>{label}</T>
      <Switch
        value={value}
        onValueChange={(next) => {
          void haptics.selection();
          onChange(next);
        }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { palette } = useA11y();
  const settings = useSettings();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const exportData = async () => {
    try {
      await shareText(JSON.stringify(await authApi.exportData(), null, 2), "GovBot");
    } catch {
      setMessage(t("m.common.error"));
    }
  };

  const deleteAccount = async () => {
    try {
      await authApi.deleteAccount(password);
      await logout();
    } catch {
      setMessage(t("m.common.error"));
    }
  };

  return (
    <Screen>
      <T variant="largeTitle">{t("m.tabs.profile")}</T>
      {user ? (
        <Card>
          <T variant="headline">{user.display_name}</T>
          <T variant="footnote" muted>
            {user.email}
          </T>
        </Card>
      ) : null}

      <T variant="title2">{t("m.profile.language")}</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SUPPORTED_LANGS.map((code) => (
          <Button
            key={code}
            tone={code === lang ? "primary" : "plain"}
            label={code.toUpperCase()}
            onPress={() => void changeLanguage(code)}
          />
        ))}
      </View>

      <ToggleRow label={t("m.profile.xlText")} value={settings.xlText} onChange={settings.setXlText} />
      <ToggleRow label={t("m.profile.highContrast")} value={settings.highContrast} onChange={settings.setHighContrast} />
      <ToggleRow label={t("m.profile.haptics")} value={settings.haptics} onChange={settings.setHaptics} />
      <ToggleRow
        label={t("m.profile.reduceMotion")}
        value={settings.reduceMotionOverride === true}
        onChange={(on) => settings.setReduceMotionOverride(on ? true : null)}
      />

      <T variant="title2">{t("m.profile.help")}</T>
      {HOTLINES.map((number) => (
        <Button
          key={number}
          tone="plain"
          label={t("m.profile.callHotline", { number })}
          onPress={() => void Linking.openURL(`tel:${number}`)}
        />
      ))}

      {user ? (
        <>
          <Button tone="plain" label={t("m.profile.exportData")} onPress={() => void exportData()} />
          <Button tone="plain" label={t("m.auth.signOut")} onPress={() => void logout()} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t("m.auth.password")}
            placeholderTextColor={palette.muted}
            accessibilityLabel={t("m.auth.password")}
            style={{ color: palette.ink, backgroundColor: palette.surface, padding: 12, borderRadius: 12 }}
          />
          <Button
            tone="plain"
            label={t("m.profile.deleteAccount")}
            disabled={password.length === 0}
            onPress={() => void deleteAccount()}
          />
        </>
      ) : (
        <Button label={t("m.auth.signIn")} onPress={() => router.push("/auth")} />
      )}
      {message ? <T style={{ color: palette.danger }}>{message}</T> : null}
    </Screen>
  );
}
