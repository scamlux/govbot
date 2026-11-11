import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { authApi } from "../../src/api/endpoints";
import { useAuth } from "../../src/auth/AuthProvider";
import { HOTLINES, SUPPORTED_LANGS, type Lang } from "../../src/config";
import { changeLanguage } from "../../src/i18n";
import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { openInApp } from "../../src/native/browser";
import { shareText } from "../../src/native/share";
import { useBillingMe, useConfig } from "../../src/query/hooks";
import { useSettings } from "../../src/state/settings";
import { useA11y } from "../../src/theme/a11y";
import { ACCENT_NAMES, accents } from "../../src/theme/tokens";
import { LargeTitleScreen } from "../../src/ui/LargeTitleScreen";
import { PressableScale } from "../../src/ui/PressableScale";
import { Avatar, Button, Eyebrow, Field, Group, Pill, Row, SwitchRow, T } from "../../src/ui/primitives";
import { Icon } from "../../src/ui/icons";
import { Sheet } from "../../src/ui/Sheet";

const WEB_BASE = "https://govbot-web.vercel.app";
const LANG_NAMES: Record<Lang, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };
const HOTLINE_LABEL: Record<(typeof HOTLINES)[number], "emergency" | "touristLine" | "portalLine"> = { "112": "emergency", "1173": "touristLine", "1242": "portalLine" };

function AccentRow() {
  const { t } = useTranslation();
  const accent = useSettings((s) => s.accent);
  const setAccent = useSettings((s) => s.setAccent);
  return (
    <View style={{ minHeight: 54, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <T>{t("m.profile.accent")}</T>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 12 }}>
        {ACCENT_NAMES.map((name) => {
          const selected = name === accent;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityLabel={t(`m.profile.accents.${name}`)}
              accessibilityState={{ selected }}
              hitSlop={10}
              onPress={() => {
                void haptics.selection();
                setAccent(name);
              }}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: selected ? accents[name].accent : "transparent" }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: accents[name].accent, alignItems: "center", justifyContent: "center" }}>
                {selected ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
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
  const config = useConfig();
  const billingEnabled = config.data?.billing_enabled === true;
  const billing = useBillingMe();
  const [langOpen, setLangOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const planName = billingEnabled && billing.data?.plan?.name ? billing.data.plan.name : t("m.profile.free");

  const exportData = async () => {
    try {
      await shareText(JSON.stringify(await authApi.exportData(), null, 2), "GovBot");
    } catch {
      setMessage(t("m.profile.exportFailed"));
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await authApi.deleteAccount(password);
      setDeleteOpen(false);
      setPassword("");
      await logout();
    } catch {
      void haptics.warning();
      setDeleteError(t("m.profile.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  const version = Constants.expoConfig?.version ?? "2.0.0";

  return (
    <>
      <LargeTitleScreen title={t("m.tabs.profile")}>
        {user ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 26, backgroundColor: palette.surface }}>
            <Avatar name={user.display_name || user.email} size={60} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <T variant="headline" weight="800" numberOfLines={1}>{user.display_name || user.full_name || user.email}</T>
              <T variant="subhead" muted numberOfLines={1}>{user.email}</T>
            </View>
            <Pill label={planName} bg="#F2F2F5" fg={palette.ink} />
          </View>
        ) : (
          <PressableScale onPress={() => router.push("/auth")} accessibilityRole="button" accessibilityLabel={t("m.profile.signInCta")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 26, backgroundColor: palette.accent }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                <Icon name="user" size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T variant="headline" weight="800" color="#FFFFFF">{t("m.profile.signInCta")}</T>
                <T variant="footnote" color="rgba(255,255,255,0.85)">{t("m.profile.signInHint")}</T>
              </View>
              <Icon name="chevronRight" size={20} color="#FFFFFF" />
            </View>
          </PressableScale>
        )}

        <Eyebrow>{t("m.profile.comfort")}</Eyebrow>
        <Group>
          <Row icon="globe" label={t("m.profile.language")} value={LANG_NAMES[lang]} onPress={() => setLangOpen(true)} />
          <SwitchRow icon="type" label={t("m.profile.xlText")} value={settings.xlText} onChange={settings.setXlText} />
          <SwitchRow icon="contrast" label={t("m.profile.highContrast")} value={settings.highContrast} onChange={settings.setHighContrast} />
          <SwitchRow icon="simple" label={t("m.profile.plainDefault")} value={settings.plainDefault} onChange={settings.setPlainDefault} />
          <SwitchRow icon="vibrate" label={t("m.profile.haptics")} value={settings.haptics} onChange={settings.setHaptics} />
          <SwitchRow
            icon="sparkle"
            label={t("m.profile.reduceMotion")}
            value={settings.reduceMotionOverride === true}
            onChange={(on) => settings.setReduceMotionOverride(on ? true : null)}
          />
          <AccentRow />
        </Group>

        <Eyebrow>{t("m.profile.help")}</Eyebrow>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {HOTLINES.map((number) => (
            <PressableScale
              key={number}
              style={{ flex: 1 }}
              onPress={() => void Linking.openURL(`tel:${number}`)}
              accessibilityRole="button"
              accessibilityLabel={t("m.profile.callHotline", { number })}
            >
              <View style={{ alignItems: "center", gap: 4, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, backgroundColor: palette.surface, minHeight: 76 }}>
                <T size={22} weight="800" color={number === "112" ? palette.danger : palette.ink}>{number}</T>
                <T size={12} muted style={{ textAlign: "center" }}>{t(`m.profile.${HOTLINE_LABEL[number]}`)}</T>
              </View>
            </PressableScale>
          ))}
        </View>

        <Group>
          {user ? <Row icon="download" label={t("m.profile.exportData")} onPress={() => void exportData()} /> : null}
          {billingEnabled ? <Row icon="card" label={t("m.profile.plan")} value={planName} onPress={() => router.push("/paywall")} /> : null}
          <Row icon="shield" label={t("m.profile.privacy")} onPress={() => void openInApp(`${WEB_BASE}/privacy`, palette.accent)} />
          <Row icon="info" label={t("m.profile.about")} onPress={() => void openInApp(`${WEB_BASE}/about`, palette.accent)} last={!user} />
          {user ? <Row icon="trash" danger label={t("m.profile.deleteAccount")} onPress={() => setDeleteOpen(true)} /> : null}
          {user ? <Row icon="logout" danger label={t("m.profile.signOut")} onPress={() => void logout()} last /> : null}
        </Group>
        {message ? <T variant="footnote" style={{ color: palette.danger, marginHorizontal: 6 }} accessibilityLiveRegion="polite">{message}</T> : null}
        <T variant="footnote" muted style={{ textAlign: "center" }}>{t("m.profile.version", { version })}</T>
      </LargeTitleScreen>

      <Sheet visible={langOpen} onClose={() => setLangOpen(false)} detents={[0.42]} label={t("m.profile.language")}>
        <T variant="title2" weight="800" style={{ marginTop: 6, marginBottom: 12 }}>{t("m.profile.language")}</T>
        <View style={{ gap: 8 }}>
          {SUPPORTED_LANGS.map((code) => {
            const selected = code === lang;
            return (
              <PressableScale
                key={code}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={LANG_NAMES[code]}
                accessibilityState={{ selected }}
                onPress={() => {
                  void changeLanguage(code);
                  setLangOpen(false);
                }}
              >
                <View style={{ minHeight: 56, borderRadius: 18, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: selected ? palette.accentTint : "#F2F2F5" }}>
                  <T weight={selected ? "700" : "500"} color={selected ? palette.accentPressed : palette.ink}>{LANG_NAMES[code]}</T>
                  {selected ? <Icon name="check" size={20} color={palette.accentPressed} strokeWidth={2.6} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </Sheet>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} detents={[0.62]} label={t("m.profile.deleteTitle")}>
        <View style={{ gap: 14, paddingTop: 6 }}>
          <T variant="title2" weight="800">{t("m.profile.deleteTitle")}</T>
          <T variant="callout" muted>{t("m.profile.deleteBody")}</T>
          <Field label={t("m.auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          {deleteError ? <T variant="footnote" style={{ color: palette.danger }} accessibilityLiveRegion="polite">{deleteError}</T> : null}
          <Button tone="danger" label={t("m.profile.deleteConfirm")} disabled={password.length === 0} loading={deleting} onPress={() => void deleteAccount()} />
        </View>
      </Sheet>
    </>
  );
}
