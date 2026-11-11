import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { chatApi } from "../../src/api/endpoints";
import { isPlanLimitError } from "../../src/api/errors";
import { streamGuestMessage, streamMessage, type GuestTurn } from "../../src/api/stream";
import type { Source } from "../../src/api/types";
import { useAuth } from "../../src/auth/AuthProvider";
import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { queryKeys } from "../../src/query/client";
import { useConversation } from "../../src/query/hooks";
import { useA11y } from "../../src/theme/a11y";
import { Button, T } from "../../src/ui/primitives";
import { Screen } from "../../src/ui/Screen";

interface Bubble {
  key: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
}

const GUEST = "guest";
const NEW = "new";

export default function ChatScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette } = useA11y();
  const { user } = useAuth();
  const { id, prefill } = useLocalSearchParams<{ id: string; prefill?: string }>();

  const isGuest = id === GUEST || (id === NEW && !user);
  const [conversationId, setConversationId] = useState<number | null>(
    id === GUEST || id === NEW ? null : Number(id),
  );
  const existing = useConversation(conversationId ?? Number.NaN);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState(prefill ?? "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!existing.data) return;
    setBubbles(
      existing.data.messages.map((m) => ({
        key: String(m.id),
        role: m.role,
        content: m.content,
        sources: m.sources ?? [],
      })),
    );
  }, [existing.data]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchLast = (change: (b: Bubble) => Bubble) =>
    setBubbles((prev) => [...prev.slice(0, -1), change(prev[prev.length - 1])]);

  const send = async () => {
    const content = draft.trim();
    if (!content || streaming) return;
    setDraft("");
    setError(null);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const history: GuestTurn[] = bubbles.map((b) => ({ role: b.role, content: b.content }));
    setBubbles((prev) => [
      ...prev,
      { key: `u${prev.length}`, role: "user", content, sources: [] },
      { key: `a${prev.length}`, role: "assistant", content: "", sources: [] },
    ]);

    const handlers = {
      signal: controller.signal,
      onDelta: (delta: string) => patchLast((b) => ({ ...b, content: b.content + delta })),
      onSources: (sources: Source[]) => patchLast((b) => ({ ...b, sources })),
    };
    try {
      if (isGuest) {
        await streamGuestMessage(content, lang, { ...handlers, history });
      } else {
        let target = conversationId;
        if (target === null) {
          target = (await chatApi.createConversation(lang)).id;
          setConversationId(target);
        }
        await streamMessage(target, content, lang, handlers);
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      }
      void haptics.success();
    } catch (e) {
      if (controller.signal.aborted) return; // user pressed stop; keep the partial reply
      if (isPlanLimitError(e)) router.push("/paywall");
      else setError(e instanceof Error ? e.message : t("m.common.error"));
      void haptics.warning();
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Screen scroll>
      {bubbles.map((bubble) => (
        <View key={bubble.key} style={{ alignSelf: bubble.role === "user" ? "flex-end" : "flex-start" }}>
          <T variant="footnote" muted>
            {bubble.role === "user" ? t("chat.you") : t("chat.assistant")}
          </T>
          <T selectable>{bubble.content}</T>
          {bubble.sources.map((s) => (
            <T key={s.slug} variant="footnote" muted>
              {t("chat.sources")} {s.title}
            </T>
          ))}
        </View>
      ))}
      {error ? <T style={{ color: palette.danger }}>{error}</T> : null}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder={t("chat.placeholder")}
        placeholderTextColor={palette.muted}
        accessibilityLabel={t("chat.placeholder")}
        style={{ color: palette.ink, backgroundColor: palette.surface, padding: 12, borderRadius: 12, minHeight: 48 }}
      />
      {streaming ? (
        <Button tone="plain" label={t("m.chat.stop")} onPress={() => abortRef.current?.abort()} />
      ) : (
        <Button label={t("common.send")} onPress={() => void send()} disabled={!draft.trim()} />
      )}
    </Screen>
  );
}
