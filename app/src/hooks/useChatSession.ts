import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { chatApi } from "../api/endpoints";
import { isApiError, isPlanLimitError } from "../api/errors";
import type { FeedbackRating, RelatedQuestion, Source } from "../api/types";
import { streamGuestMessage, streamMessage, type GuestTurn } from "../api/stream";
import { useAuth } from "../auth/AuthProvider";
import type { Lang } from "../config";
import { chatReducer, initialChatState, type Bubble } from "../domain/chatReducer";
import { haptics } from "../native/haptics";
import { queryKeys } from "../query/client";
import { useConversation } from "../query/hooks";

const FLUSH_MS = 60;

export const CHAT_NEW = "new";
export const CHAT_GUEST = "guest";

/** Owns one chat: server history, streaming turns, stop, retry, feedback. Pure logic lives in chatReducer. */
export function useChatSession({ routeId, lang, plain }: { routeId: string; lang: Lang; plain: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGuest = routeId === CHAT_GUEST || (routeId === CHAT_NEW && !user);
  const [conversationId, setConversationId] = useState<number | null>(routeId === CHAT_GUEST || routeId === CHAT_NEW ? null : Number(routeId));
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [related, setRelated] = useState<RelatedQuestion[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const conversation = useConversation(conversationId ?? Number.NaN);

  useEffect(() => {
    if (conversation.data) dispatch({ type: "load", messages: conversation.data.messages });
  }, [conversation.data]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || stateRef.current.streaming) return;
      void haptics.light();
      setRelated([]);
      const history: GuestTurn[] = stateRef.current.bubbles.filter((b) => b.content).map((b) => ({ role: b.role, content: b.content }));
      seqRef.current += 1;
      dispatch({ type: "send", content, seq: seqRef.current });

      const controller = new AbortController();
      abortRef.current = controller;
      // Buffer deltas so a fast stream does not re-render per token.
      let buffer = "";
      let timer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => {
        timer = null;
        if (!buffer) return;
        dispatch({ type: "delta", text: buffer });
        buffer = "";
      };
      const handlers = {
        signal: controller.signal,
        plain,
        onDelta: (delta: string) => {
          buffer += delta;
          if (!timer) timer = setTimeout(flush, FLUSH_MS);
        },
        onMeta: (meta: Record<string, unknown>) => dispatch({ type: "meta", language: typeof meta.language === "string" ? meta.language : null }),
        onSources: (sources: Source[]) => dispatch({ type: "sources", sources }),
        onStatus: (status: Record<string, unknown>) => {
          if (status.degraded) dispatch({ type: "degraded" });
        },
      };

      try {
        let result;
        if (isGuest) {
          result = await streamGuestMessage(content, lang, { ...handlers, history });
        } else {
          let target = conversationId;
          if (target === null) {
            target = (await chatApi.createConversation(lang)).id;
            setConversationId(target);
          }
          result = await streamMessage(target, content, lang, handlers);
          void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        }
        if (timer) clearTimeout(timer);
        flush();
        dispatch({ type: "done", result });
        void haptics.success();
        chatApi
          .related(content, lang)
          .then(setRelated)
          .catch(() => undefined);
      } catch (e) {
        if (timer) clearTimeout(timer);
        flush();
        if (controller.signal.aborted) {
          dispatch({ type: "stop" });
          return;
        }
        void haptics.warning();
        if (isPlanLimitError(e)) {
          dispatch({ type: "fail", message: t("m.chat.limitReached") });
          router.push({ pathname: "/paywall", params: e.limit !== null ? { limit: String(e.limit) } : {} });
        } else if (isApiError(e) && e.isNetwork) {
          dispatch({ type: "fail", message: t("m.chat.networkError") });
        } else {
          dispatch({ type: "fail", message: e instanceof Error && e.message ? e.message : t("m.common.error") });
        }
      } finally {
        abortRef.current = null;
      }
    },
    [conversationId, isGuest, lang, plain, queryClient, router, t],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    const question = stateRef.current.lastQuestion;
    if (question) void send(question);
  }, [send]);

  const rate = useCallback(async (bubble: Bubble, rating: FeedbackRating, reason?: string) => {
    if (bubble.id === null || isGuest) return;
    try {
      const feedback = await chatApi.feedback(bubble.id, rating, reason);
      dispatch({ type: "feedback", id: bubble.id, feedback });
      void haptics.success();
    } catch {
      void haptics.warning();
    }
  }, [isGuest]);

  return { state, send, stop, retry, rate, related, isGuest, conversationId, title: conversation.data?.title ?? "", loadingHistory: conversationId !== null && conversation.isLoading };
}
