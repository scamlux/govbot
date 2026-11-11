import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput } from "react-native";
import { useTranslation } from "react-i18next";

import { isApiError } from "../src/api/errors";
import { useAuth } from "../src/auth/AuthProvider";
import { useLang } from "../src/i18n/useLang";
import { haptics } from "../src/native/haptics";
import { useA11y } from "../src/theme/a11y";
import { Button, T } from "../src/ui/primitives";
import { Screen } from "../src/ui/Screen";

export default function AuthModal() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { login, register } = useAuth();
  const { palette } = useA11y();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signIn") await login(email.trim(), password);
      else await register({ email: email.trim(), password, full_name: fullName.trim(), preferred_language: lang });
      void haptics.success();
      router.back();
    } catch (e) {
      void haptics.warning();
      setError(isApiError(e) && e.detail ? e.detail : t("m.auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  const input = { color: palette.ink, backgroundColor: palette.surface, padding: 12, borderRadius: 12 };
  return (
    <Screen>
      <T variant="title1">{t(mode === "signIn" ? "m.auth.title" : "m.auth.signUp")}</T>
      {mode === "signUp" ? (
        <TextInput
          style={input}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t("m.auth.fullName")}
          placeholderTextColor={palette.muted}
          accessibilityLabel={t("m.auth.fullName")}
          autoComplete="name"
        />
      ) : null}
      <TextInput
        style={input}
        value={email}
        onChangeText={setEmail}
        placeholder={t("m.auth.email")}
        placeholderTextColor={palette.muted}
        accessibilityLabel={t("m.auth.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={input}
        value={password}
        onChangeText={setPassword}
        placeholder={t("m.auth.password")}
        placeholderTextColor={palette.muted}
        accessibilityLabel={t("m.auth.password")}
        secureTextEntry
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
      />
      {error ? <T style={{ color: palette.danger }}>{error}</T> : null}
      <Button label={t(mode === "signIn" ? "m.auth.signIn" : "m.auth.signUp")} onPress={() => void submit()} disabled={busy || !email || !password} />
      <Button
        tone="plain"
        label={t(mode === "signIn" ? "m.auth.signUp" : "m.auth.signIn")}
        onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      />
    </Screen>
  );
}
