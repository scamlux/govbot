import * as Clipboard from "expo-clipboard";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../src/auth/AuthProvider";
import { splitBlocks, type Bubble } from "../../src/domain/chatReducer";
import { CHAT_NEW, useChatSession } from "../../src/hooks/useChatSession";
import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { conversationToMarkdown, shareText } from "../../src/native/share";
import { speak, stopSpeaking } from "../../src/native/speech";
import { useConfig } from "../../src/query/hooks";
import { useSettings } from "../../src/state/settings";
import { useA11y } from "../../src/theme/a11y";
import { AssistantBubble, UserBubble } from "../../src/ui/chat/Bubbles";
import { Composer } from "../../src/ui/chat/Composer";
import { Icon } from "../../src/ui/icons";
import { PressableScale } from "../../src/ui/PressableScale";
import { Button, Chip, Field, IconButton, T } from "../../src/ui/primitives";
import { Sheet } from "../../src/ui/Sheet";
import { ErrorState, OfflineBanner } from "../../src/ui/States";
import { SkeletonList } from "../../src/ui/Skeleton";

const HEADER_BAR = 56;
const AUTOSCROLL_MS = 120;
const SUGGESTIONS = ["chat.suggestion1", "chat.suggestion2", "chat.suggestion3"] as const;

export default function ChatScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useA11y();
  const { user } = useAuth();
  const config = useConfig();
  const plainDefault = useSettings((s) => s.plainDefault);
  const { id, prefill, autoSend } = useLocalSearchParams<{ id: string; prefill?: string; autoSend?: string }>();
  const routeId = String(id ?? CHAT_NEW);

  const [plain, setPlain] = useState(plainDefault);
  const [draft, setDraft] = useState(prefill ?? "");
  const session = useChatSession({ routeId, lang, plain });
  const { state } = session;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const autoSent = useRef(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<Bubble | null>(null);
  const [reason, setReason] = useState("");

  // Guests are only allowed when the server enables guest chat.
  useEffect(() => {
    if (routeId === CHAT_NEW && !user && config.data && !config.data.guest_chat) router.replace("/auth");
  }, [routeId, user, config.data, router]);

  useEffect(() => {
    if (autoSend === "1" && prefill && !autoSent.current && config.isFetched) {
      autoSent.current = true;
      setDraft("");
      void session.send(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, prefill, config.isFetched]);

  useEffect(() => () => void stopSpeaking(), []);

  useEffect(() => {
    if (!notice) return undefined;
    const handle = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(handle);
  }, [notice]);

  const submit = useCallback(() => {
    const text = draft;
    setDraft("");
    void session.send(text);
  }, [draft, session]);

  const toggleSpeak = async (bubble: Bubble) => {
    if (speakingKey === bubble.key) {
      await stopSpeaking();
      setSpeakingKey(null);
      return;
    }
    const target = (bubble.language === "uz" || bubble.language === "ru" || bubble.language === "en" ? bubble.language : lang) as typeof lang;
    const ok = await speak(bubble.content, target, () => setSpeakingKey(null));
    if (ok) setSpeakingKey(bubble.key);
    else {
      void haptics.warning();
      setNotice(t("m.chat.noVoice", { language: target.toUpperCase() }));
    }
  };

  const copy = async (bubble: Bubble) => {
    await Clipboard.setStringAsync(bubble.content);
    void haptics.success();
    setCopiedKey(bubble.key);
    setTimeout(() => setCopiedKey((k) => (k === bubble.key ? null : k)), 1600);
  };

  const exportChat = async () => {
    try {
      const md = conversationToMarkdown(
        { title: session.title, messages: state.bubbles.map((b) => ({ id: b.id ?? 0, role: b.role, content: b.content, model: null, tokens: null, sources: [...b.sources], feedback: b.feedback, created_at: "" })) },
        { you: t("chat.you"), assistant: t("chat.assistant"), sources: t("chat.sources") },
      );
      await shareText(md, session.title || "GovBot");
    } catch {
      setNotice(t("m.chat.exportFailed"));
    }
  };

  const submitFeedback = async () => {
    if (!feedbackFor) return;
    const target = feedbackFor;
    setFeedbackFor(null);
    await session.rate(target, "down", reason.trim() || undefined);
    setReason("");
    setNotice(t("m.chat.feedbackThanks"));
  };

  const empty = state.bubbles.length === 0 && !session.loadingHistory;
  const degraded = state.degraded || config.data?.ai_mode === "degraded";
  const lastAssistant = [...state.bubbles].reverse().find((b) => b.role === "assistant" && !b.streaming && b.content);
  const subtitle = t("m.chat.subtitle", { lang: lang.toUpperCase() });
  const title = session.title || (state.bubbles[0]?.content ? splitBlocks(state.bubbles[0].content)[0].slice(0, 40) : t("chat.assistant"));

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          ref={scroller}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), AUTOSCROLL_MS)}
          contentContainerStyle={{ paddingTop: insets.top + HEADER_BAR + 14, paddingHorizontal: 16, paddingBottom: 16, gap: 16, flexGrow: 1 }}
        >
          <OfflineBanner />
          {degraded ? (
            <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "#FDF6E6" }}>
              <Icon name="alert" size={18} color="#7A5413" />
              <View style={{ flex: 1 }}>
                <T variant="footnote" color="#7A5413">{t("m.home.aiMode.degraded")}</T>
              </View>
            </View>
          ) : null}
          {session.isGuest ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 16, backgroundColor: palette.accentTint }}>
              <View style={{ flex: 1 }}>
                <T variant="footnote" weight="700" color={palette.accentPressed}>{t("chat.guestTitle")}</T>
                <T variant="footnote" color="#3A3A3C">{t("chat.guestNote")}</T>
              </View>
              <Button size="md" tone="primary" label={t("chat.guestSignIn")} onPress={() => router.push("/auth")} style={{ paddingHorizontal: 12 }} />
            </View>
          ) : null}

          {session.loadingHistory && state.bubbles.length === 0 ? <SkeletonList count={2} /> : null}

          {empty ? (
            <Animated.View entering={FadeInDown.duration(300)} style={{ flex: 1, justifyContent: "center", gap: 16, paddingVertical: 24 }}>
              <View style={{ gap: 6 }}>
                <T size={26} weight="800" ls={-0.025} accessibilityRole="header">{t("chat.emptyTitle")}</T>
                <T variant="callout" muted>{t("m.chat.emptyHint")}</T>
              </View>
              <View style={{ gap: 10 }}>
                {SUGGESTIONS.map((key) => (
                  <PressableScale key={key} scaleTo={0.98} onPress={() => void session.send(t(key))} accessibilityRole="button" accessibilityLabel={t(key)}>
                    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: palette.surface }}>
                      <Icon name="sparkle" size={18} color={palette.accent} />
                      <View style={{ flex: 1 }}>
                        <T variant="callout" weight="600">{t(key)}</T>
                      </View>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </Animated.View>
          ) : null}

          {state.bubbles.map((bubble) =>
            bubble.role === "user" ? (
              <UserBubble key={bubble.key} content={bubble.content} />
            ) : (
              <AssistantBubble
                key={bubble.key}
                bubble={bubble}
                uiLanguage={lang}
                speaking={speakingKey === bubble.key}
                copied={copiedKey === bubble.key}
                canRate={!session.isGuest && bubble.id !== null}
                onSpeak={() => void toggleSpeak(bubble)}
                onCopy={() => void copy(bubble)}
                onThumbUp={() => void session.rate(bubble, "up")}
                onThumbDown={() => {
                  setReason("");
                  setFeedbackFor(bubble);
                }}
              />
            ),
          )}

          {session.related.length > 0 && lastAssistant && !state.streaming ? (
            <View style={{ gap: 8, marginLeft: 40 }}>
              <T variant="footnote" muted weight="700">{t("chat.relatedTitle")}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {session.related.map((q) => (
                  <Chip key={q.slug} label={q.title} tone="tint" onPress={() => void session.send(q.title)} />
                ))}
              </View>
            </View>
          ) : null}

          {state.error ? (
            <ErrorState title={state.error} body={undefined} onRetry={state.lastQuestion ? session.retry : undefined} />
          ) : null}
          {notice ? (
            <T variant="footnote" muted style={{ textAlign: "center" }} accessibilityLiveRegion="polite">{notice}</T>
          ) : null}
        </ScrollView>

        <Composer
          value={draft}
          onChange={setDraft}
          onSend={submit}
          onStop={session.stop}
          onVoice={() => router.push("/voice")}
          streaming={state.streaming}
          plain={plain}
          onTogglePlain={() => {
            void haptics.selection();
            setPlain((v) => !v);
          }}
        />
      </KeyboardAvoidingView>

      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top, height: insets.top + HEADER_BAR }}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(245,246,248,0.82)", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" }]} />
        <View style={{ height: HEADER_BAR, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 4 }}>
          <IconButton icon="chevronLeft" label={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} color={palette.accent} />
          <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
            <T variant="callout" weight="700" numberOfLines={1}>{title}</T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success }} />
              <T size={12} muted numberOfLines={1}>{subtitle}</T>
            </View>
          </View>
          <IconButton icon="share" label={t("m.chat.share")} onPress={() => void exportChat()} />
          <IconButton icon="edit" label={t("m.chat.newConversation")} onPress={() => router.replace({ pathname: "/chat/[id]", params: { id: CHAT_NEW } })} />
        </View>
      </View>

      <Sheet visible={feedbackFor !== null} onClose={() => setFeedbackFor(null)} detents={[0.5]} label={t("m.chat.feedbackSheet")}>
        <View style={{ gap: 14, paddingTop: 6 }}>
          <T variant="title2" weight="800">{t("m.chat.feedbackSheet")}</T>
          <Field label={t("chat.feedbackDown")} placeholder={t("chat.feedbackReasonPlaceholder")} value={reason} onChangeText={setReason} multiline />
          <Button label={t("m.chat.feedbackSend")} onPress={() => void submitFeedback()} />
        </View>
      </Sheet>
    </View>
  );
}
