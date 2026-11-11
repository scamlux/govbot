import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { authErrorKey, type AuthMode as Mode } from "../src/domain/authErrors";
import { useAuth } from "../src/auth/AuthProvider";
import { useLang } from "../src/i18n/useLang";
import { haptics } from "../src/native/haptics";
import { openInApp } from "../src/native/browser";
import { useA11y } from "../src/theme/a11y";
import { Icon } from "../src/ui/icons";
import { Button, Field, IconButton, T } from "../src/ui/primitives";
import { Sheet } from "../src/ui/Sheet";

const WEB_BASE = "https://govbot-web.vercel.app";
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Auth bottom sheet (transparent modal route): login / register with localized errors. */
export default function AuthSheet() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  // A guest's question typed before sign-in (from the chat redirect) is re-sent afterwards.
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const signedIn = useRef(false);
  const { login, register } = useAuth();
  const { palette } = useA11y();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
  };
  const finish = () => {
    if (signedIn.current && prefill) {
      router.replace({ pathname: "/chat/[id]", params: { id: "new", prefill, autoSend: "1" } });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t("m.auth.emailInvalid"));
    if (password.length < MIN_PASSWORD) return setError(t("m.auth.passwordShort"));
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register({ email: email.trim(), password, full_name: fullName.trim() || undefined, preferred_language: lang });
      void haptics.success();
      signedIn.current = true;
      close();
    } catch (e) {
      void haptics.warning();
      setError(t(authErrorKey(e, mode)));
    } finally {
      setBusy(false);
    }
  };

  const modeButton = (value: Mode, label: string) => {
    const selected = mode === value;
    return (
      <Pressable
        key={value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={() => {
          void haptics.selection();
          setMode(value);
          setError(null);
        }}
        style={{ flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: selected ? "#FFFFFF" : "transparent", shadowColor: "#000", shadowOpacity: selected ? 0.1 : 0, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: selected ? 2 : 0 }}
      >
        <T variant="subhead" weight={selected ? "700" : "600"} color={selected ? palette.ink : "#3A3A3C"}>{label}</T>
      </Pressable>
    );
  };

  return (
    <Sheet visible={open} onClose={finish} onClosed={finish} detents={[0.8, 0.94]} label={t("m.auth.sheetTitle")}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T size={26} weight="800" ls={-0.025} accessibilityRole="header">{t("m.auth.sheetTitle")}</T>
            <T variant="subhead" muted style={{ marginTop: 6 }}>{t("m.auth.sheetSub")}</T>
          </View>
          <IconButton icon="close" label={t("m.common.close")} onPress={close} color={palette.muted} bg="#F2F2F5" />
        </View>

        <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: "#F2F2F5" }}>
          {modeButton("login", t("m.auth.signIn"))}
          {modeButton("register", t("m.auth.signUp"))}
        </View>

        {mode === "register" ? (
          <Field label={t("m.auth.fullName")} value={fullName} onChangeText={setFullName} focused={focus === "name"} onFocus={() => setFocus("name")} autoComplete="name" textContentType="name" />
        ) : null}
        <Field
          label={t("m.auth.email")}
          value={email}
          onChangeText={setEmail}
          focused={focus === "email"}
          onFocus={() => setFocus("email")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
        <Field
          label={t("m.auth.password")}
          value={password}
          onChangeText={setPassword}
          focused={focus === "password"}
          onFocus={() => setFocus("password")}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onSubmitEditing={() => void submit()}
          trailing={
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? t("m.auth.hidePassword") : t("m.auth.showPassword")} onPress={() => setShowPassword((v) => !v)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Icon name={showPassword ? "eyeOff" : "eye"} size={20} color={palette.muted} />
            </Pressable>
          }
        />
        {mode === "register" ? <T variant="footnote" muted style={{ marginTop: -8 }}>{t("auth.passwordHint")}</T> : null}
        {error ? <T variant="footnote" weight="600" color={palette.danger} accessibilityLiveRegion="polite">{error}</T> : null}

        <Button label={mode === "login" ? t("m.auth.signIn") : t("m.auth.signUp")} onPress={() => void submit()} loading={busy} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "#E5E5EA" }} />
          <T variant="footnote" muted>{t("m.auth.soon")}</T>
          <View style={{ flex: 1, height: 1, backgroundColor: "#E5E5EA" }} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[t("m.auth.phone"), t("m.auth.oneId")].map((label) => (
            <View key={label} accessible accessibilityState={{ disabled: true }} accessibilityLabel={`${label}, ${t("m.auth.soon")}`} style={{ flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: "#F2F2F5", alignItems: "center", justifyContent: "center" }}>
              <T variant="subhead" weight="600" muted>{label}</T>
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="link" onPress={() => void openInApp(`${WEB_BASE}/privacy`, palette.accent)} style={{ minHeight: 44, justifyContent: "center" }}>
          <T variant="caption" muted style={{ textAlign: "center" }}>{t("m.auth.terms")}</T>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}
