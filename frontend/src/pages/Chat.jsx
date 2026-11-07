import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { chatApi, streamMessage, streamGuestMessage, fetchRelated } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";
import { AiDisclaimer, AiOnboarding } from "../components/AiNotice";
import { useConfirm } from "../components/ConfirmDialog";
import MessageBubble from "../components/MessageBubble";
import RelatedQuestions from "../components/RelatedQuestions";
import Spinner from "../components/Spinner";
import { useSpeechInput } from "../hooks/useSpeechInput";
import Icon from "../components/Icon";
import { exportConversationMarkdown } from "../utils/exportConversation";
import { takePendingQuestion } from "../utils/pendingQuestion";

// S3 — mirror the server-side cap (CHAT_MAX_MESSAGE_CHARS) as a client hint.
const MAX_CHARS = 4000;
// B1 — how many prior turns a guest sends with each question (server caps at 10 too).
const GUEST_HISTORY = 10;
const PLAIN_KEY = "govbot.plainLanguage";

const LANG_NAMES = { uz: "O'zbekcha", ru: "Русский", en: "English" };

function readPlain() {
  try {
    return localStorage.getItem(PLAIN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The chat page. Two modes share one UI:
 *  - signed in: conversations are persisted and listed in the sidebar;
 *  - guest (B1, only when the backend enables it): a single local thread, nothing stored.
 */
export default function Chat({ guest = false, embedded = false }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { ai_mode: aiMode } = useConfig();
  // Label for freshly streamed replies (persisted ones carry `model` from the API).
  const liveModel = aiMode === "mock" ? "mock" : aiMode === "catalog_only" ? "catalog" : undefined;
  // The embedded widget (D2) is always a guest: a third-party page must never drive a
  // signed-in session, even if the visitor is logged in on the GovBot site.
  const isGuest = guest && (embedded || !user);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const [streamingSources, setStreamingSources] = useState([]);
  // R5 — related-question chips shown under the last assistant reply.
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // R5 — simple-language answers, remembered per browser.
  const [plain, setPlain] = useState(readPlain);
  // #1 — set when a streamed reply arrives flagged as a fallback (LLM unavailable).
  const [degradedSeen, setDegradedSeen] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const prefillConsumed = useRef(false);
  // R5 — lets the user stop a reply mid-stream.
  const abortRef = useRef(null);
  // Mirrors activeId so an in-flight stream can tell if the user switched away.
  const activeIdRef = useRef(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  // Id of a conversation we just created locally (first message of a new chat).
  // The load effect must NOT refetch it — the server row is still empty at that
  // moment, so fetching would overwrite the optimistic user message with [].
  const justCreatedRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(PLAIN_KEY, plain ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [plain]);

  const autoGrowInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const resetInputHeight = useCallback(() => {
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Load conversation list on mount (signed-in only).
  useEffect(() => {
    if (isGuest) return;
    chatApi
      .conversations()
      .then(({ data }) => setConversations(data))
      .catch(() => setConversations([]));
  }, [isGuest]);

  // Load messages when the active conversation changes.
  useEffect(() => {
    if (isGuest) return;
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (justCreatedRef.current === activeId) {
      justCreatedRef.current = null;
      return;
    }
    let active = true;
    setLoadingConv(true);
    chatApi
      .conversation(activeId)
      .then(({ data }) => {
        if (!active) return;
        setMessages(data.messages);
        scrollToBottom();
      })
      .catch(() => active && setMessages([]))
      .finally(() => active && setLoadingConv(false));
    return () => {
      active = false;
    };
  }, [activeId, scrollToBottom, isGuest]);

  // Abort any in-flight stream when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const refreshConversations = useCallback(() => {
    if (isGuest) return;
    chatApi.conversations().then(({ data }) => setConversations(data)).catch(() => {});
  }, [isGuest]);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setInput("");
    setRelatedQuestions([]);
    resetInputHeight();
    setSidebarOpen(false);
  }, [resetInputHeight]);

  const openConversation = useCallback((id) => {
    setActiveId(id);
    setRelatedQuestions([]);
    setSidebarOpen(false);
  }, []);

  const ensureConversation = useCallback(async () => {
    if (activeId) return activeId;
    const { data } = await chatApi.createConversation(i18n.language);
    justCreatedRef.current = data.id;
    setActiveId(data.id);
    setConversations((prev) => [data, ...prev]);
    return data.id;
  }, [activeId, i18n.language]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text, baseMessages) => {
      const content = text.trim();
      if (!content || sending) return;
      setSending(true);
      setInput("");
      resetInputHeight();
      inputRef.current?.focus();

      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      const priorMessages = baseMessages ?? messages;
      setMessages((prev) => [...prev, optimistic]);
      setStreamingText("");
      setStreamingSources([]);
      setRelatedQuestions([]);
      scrollToBottom();

      const controller = new AbortController();
      abortRef.current = controller;
      let convId = isGuest ? "guest" : undefined;
      let partial = "";
      const callbacks = {
        signal: controller.signal,
        plain,
        onDelta: (delta) => {
          if (activeIdRef.current !== convId && !isGuest) return;
          partial += delta;
          setStreamingText((prev) => (prev ?? "") + delta);
          scrollToBottom();
        },
        onSources: (srcs) => {
          if (activeIdRef.current !== convId && !isGuest) return;
          setStreamingSources(srcs); // B2
        },
        onStatus: (status) => {
          if (status?.degraded) setDegradedSeen(true);
        },
      };

      const commitAssistant = (msg) =>
        setMessages((prev) => [
          ...prev,
          { created_at: new Date().toISOString(), role: "assistant", ...msg },
        ]);

      try {
        let result;
        if (isGuest) {
          const history = priorMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-GUEST_HISTORY)
            .map((m) => ({ role: m.role, content: m.content }));
          result = await streamGuestMessage(content, i18n.language, { ...callbacks, history });
        } else {
          convId = await ensureConversation();
          result = await streamMessage(convId, content, i18n.language, callbacks);
        }
        if (isGuest || activeIdRef.current === convId) {
          commitAssistant({
            id: result.assistantMessageId ?? `a-${Date.now()}`,
            content: result.content,
            sources: result.sources || [],
            language: result.language,
            model: result.degraded ? "fallback" : liveModel,
            kind: result.degraded ? "degraded" : undefined,
          });
          setStreamingText(null);
          setStreamingSources([]);
          // A degraded (catalog-fallback) reply already lists catalog links; extra
          // "related questions" chips under a failure notice would only add noise.
          if (!result.degraded) {
            fetchRelated(content, result.language || i18n.language)
              .then((qs) => {
                if (isGuest || activeIdRef.current === convId) setRelatedQuestions(qs);
              })
              .catch(() => setRelatedQuestions([]));
          }
        }
        refreshConversations();
      } catch (err) {
        if (isGuest || activeIdRef.current === convId) {
          if (err?.name === "AbortError") {
            // Keep what was streamed so far, clearly marked as stopped.
            commitAssistant({
              id: `stopped-${Date.now()}`,
              content: partial ? `${partial}\n\n_${t("chat.stopped")}_` : `_${t("chat.stopped")}_`,
            });
          } else {
            commitAssistant({
              id: `err-${Date.now()}`,
              kind: "error",
              content: err?.status === 429 ? t("chat.rateLimited") : t("r6.errorBody"),
            });
          }
          setStreamingText(null);
          setStreamingSources([]);
        }
        // A persisted conversation may have stored the partial reply; refresh the list.
        refreshConversations();
      } finally {
        abortRef.current = null;
        setSending(false);
        scrollToBottom();
        if (isGuest || activeIdRef.current === convId) inputRef.current?.focus();
      }
    },
    [
      sending,
      messages,
      isGuest,
      plain,
      ensureConversation,
      i18n.language,
      refreshConversations,
      scrollToBottom,
      resetInputHeight,
      t,
      liveModel,
    ]
  );

  // #1 — resend the last user question, replacing the failed / fallback reply.
  const retryLast = useCallback(() => {
    if (sending) return;
    let idx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    const base = messages.slice(0, idx);
    setMessages(base);
    send(messages[idx].content, base);
  }, [messages, send, sending]);

  // Pre-fill from "Ask the AI about this" (scenario detail / search palette) — runs once.
  useEffect(() => {
    if (prefillConsumed.current) return;
    // #10 — router state first, then the question saved before the login detour.
    const saved = takePendingQuestion();
    const prefill = location.state?.prefill || saved;
    if (prefill) {
      prefillConsumed.current = true;
      setInput(prefill);
      requestAnimationFrame(autoGrowInput);
      inputRef.current?.focus();
    }
  }, [location.state, autoGrowInput]);

  const deleteConversation = useCallback(
    async (id, e) => {
      e.stopPropagation();
      if (!(await confirm({ message: t("chat.deleteConfirm"), danger: true }))) return;
      await chatApi.deleteConversation(id).catch(() => {});
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) startNewChat();
    },
    [activeId, startNewChat, t, confirm]
  );

  // A2 — rate an assistant reply; optimistically reflect it in local message state.
  const submitFeedback = useCallback(async (messageId, rating, reason) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback: { rating, reason: reason || "" } } : m
      )
    );
    try {
      await chatApi.feedback(messageId, rating, reason || "");
    } catch {
      /* keep the optimistic state; a transient failure shouldn't nag the user */
    }
  }, []);

  // D2 — dictation into the input box (hidden when unsupported).
  const { supported: voiceSupported, listening, toggle: toggleVoice } = useSpeechInput({
    lang: i18n.language,
    onResult: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      requestAnimationFrame(autoGrowInput);
    },
  });

  // D3 — download the active conversation as Markdown (incl. sources).
  const activeConversation = conversations.find((c) => c.id === activeId);
  const exportConversation = useCallback(() => {
    exportConversationMarkdown({
      title: activeConversation?.title || t("chat.newChat"),
      messages,
      sourcesLabel: t("chat.sources"),
      youLabel: `${t("r6.exportYou")}`,
      botLabel: t("r6.exportBot"),
    });
  }, [activeConversation, messages, t]);

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const showEmpty = messages.length === 0 && streamingText === null;
  const canExport = messages.length > 0 && !sending;
  const nearLimit = input.length > MAX_CHARS * 0.8;
  const activeTitle = isGuest
    ? t("chat.guestTitle")
    : conversations.find((c) => c.id === activeId)?.title || t("chat.newChat");

  return (
    <div
      className={[
        "chat-layout",
        isGuest && "chat-layout-guest",
        embedded && "chat-layout-embedded",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AiOnboarding />
      <div className="chat-shell">
      {!isGuest && sidebarOpen && (
        <div className="chat-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      {!isGuest && (
        <aside
          className={sidebarOpen ? "chat-sidebar open" : "chat-sidebar"}
          aria-label={t("chat.conversations")}
        >
          <button type="button" className="btn btn-primary btn-block" onClick={startNewChat}>
            <Icon name="plus" size={18} /> {t("chat.newChat")}
          </button>
          <h2 className="sidebar-title">{t("chat.conversations")}</h2>
          <ul className="conv-list">
            {conversations.length === 0 && (
              <li className="conv-empty">{t("chat.noConversations")}</li>
            )}
            {conversations.map((c) => (
              <li key={c.id} className={c.id === activeId ? "conv-item active" : "conv-item"}>
                <button
                  type="button"
                  className="conv-open"
                  aria-current={c.id === activeId ? "true" : undefined}
                  onClick={() => openConversation(c.id)}
                >
                  <span className="conv-title">{c.title || t("chat.newChat")}</span>
                </button>
                <button
                  type="button"
                  className="conv-del"
                  aria-label={`${t("common.delete")}: ${c.title || t("chat.newChat")}`}
                  onClick={(e) => deleteConversation(c.id, e)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <section className="chat-main" aria-labelledby="chat-heading">
        <h1 id="chat-heading" className="visually-hidden">
          {activeTitle}
        </h1>
        <div className="chat-toolbar">
          {!isGuest && (
            <button
              type="button"
              className="btn btn-outline btn-sm chat-sidebar-toggle"
              aria-expanded={sidebarOpen}
              aria-label={t("chat.conversations")}
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="list" size={18} />
              <span className="chat-toolbar-text">{t("chat.conversations")}</span>
            </button>
          )}
          <span className="chat-toolbar-title">{activeTitle}</span>
          <div className="chat-toolbar-actions">
            {!isGuest && activeId && (
              <button
                type="button"
                className="btn btn-outline btn-sm chat-toolbar-new"
                onClick={startNewChat}
                aria-label={t("chat.newChat")}
              >
                <Icon name="plus" size={18} />
                <span className="chat-toolbar-text">{t("chat.newChat")}</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={exportConversation}
              disabled={!canExport}
              aria-label={t("chat.export")}
            >
              <Icon name="download" size={18} />
              <span className="chat-toolbar-text">{t("chat.export")}</span>
            </button>
          </div>
        </div>

        {(aiMode === "degraded" || degradedSeen) && (
          <div className="notice notice-info chat-notice" role="status">
            <Icon name="info" size={20} className="notice-icon" />
            <span>{t("r6.degradedBanner")}</span>
          </div>
        )}

        {isGuest && !embedded && (
          <div className="guest-banner" role="note">
            <span>{t("chat.guestNote")}</span>
            <Link to="/login" state={{ from: { pathname: "/chat" } }} className="btn btn-outline btn-sm">
              {t("chat.guestSignIn")}
            </Link>
          </div>
        )}

        <div
          className="chat-messages"
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={sending}
          tabIndex={0}
        >
          {loadingConv ? (
            <Spinner />
          ) : showEmpty ? (
            <div className="chat-empty">
              <div className="chat-empty-mark" aria-hidden="true" />
              <h2>{t("chat.emptyTitle")}</h2>
              <p>{t("chat.emptySubtitle")}</p>
              <div className="suggestions">
                {["suggestion1", "suggestion2", "suggestion3"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="chip"
                    onClick={() => send(t(`chat.${k}`))}
                  >
                    {t(`chat.${k}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-column">
              {messages.map((m, idx) => (
                <MessageBubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  sources={m.sources}
                  language={m.language}
                  uiLanguage={i18n.language}
                  langNames={LANG_NAMES}
                  messageId={typeof m.id === "number" ? m.id : undefined}
                  feedback={m.feedback}
                  onFeedback={submitFeedback}
                  model={m.model}
                  kind={m.kind}
                  onRetry={
                    m.kind && idx === messages.length - 1 && !sending ? retryLast : undefined
                  }
                />
              ))}
              {streamingText !== null && (
                <MessageBubble
                  role="assistant"
                  content={streamingText}
                  sources={streamingSources}
                  pending
                />
              )}
              {streamingText === null && !sending && (
                <RelatedQuestions items={relatedQuestions} onPick={send} />
              )}
            </div>
          )}
        </div>

        <div className="chat-composer">
          <div className="chat-options">
            <label className="toggle">
              <input
                type="checkbox"
                checked={plain}
                onChange={(e) => setPlain(e.target.checked)}
              />
              <span>{t("chat.plainLanguage")}</span>
            </label>
          </div>
          <form className="chat-input-bar" onSubmit={onSubmit}>
            <span className="lang-indicator">
              {i18n.language.toUpperCase()}
            </span>
            <textarea
              ref={inputRef}
              className="chat-input"
              rows={1}
              maxLength={MAX_CHARS}
              placeholder={t("chat.placeholder")}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoGrowInput();
              }}
              onKeyDown={onKeyDown}
              aria-label={t("chat.placeholder")}
            />
            {nearLimit && (
              <span className="char-counter" aria-live="polite">
                {input.length}/{MAX_CHARS}
              </span>
            )}
            {voiceSupported && (
              <button
                type="button"
                className={listening ? "chat-mic listening" : "chat-mic"}
                onClick={toggleVoice}
                aria-label={t("chat.voiceInput")}
                aria-pressed={listening}
              >
                🎤
              </button>
            )}
            {sending ? (
              <button
                type="button"
                className="chat-send chat-stop"
                onClick={stop}
                aria-label={t("chat.stopAnswer")}
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                className="chat-send"
                disabled={!input.trim()}
                aria-label={t("common.send")}
              >
                ↑
              </button>
            )}
          </form>
          <AiDisclaimer />
        </div>
      </section>
      </div>
    </div>
  );
}
