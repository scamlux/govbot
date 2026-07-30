import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { chatApi, streamMessage, fetchRelated } from "../api/endpoints";
import MessageBubble from "../components/MessageBubble";
import RelatedQuestions from "../components/RelatedQuestions";
import Spinner from "../components/Spinner";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { exportConversationMarkdown } from "../utils/exportConversation";

// S3 — mirror the server-side cap (CHAT_MAX_MESSAGE_CHARS) as a client hint.
const MAX_CHARS = 4000;

export default function Chat() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

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

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const prefillConsumed = useRef(false);
  // Mirrors activeId so an in-flight stream can tell if the user switched away.
  const activeIdRef = useRef(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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

  // Load conversation list on mount.
  useEffect(() => {
    chatApi
      .conversations()
      .then(({ data }) => setConversations(data))
      .catch(() => setConversations([]));
  }, []);

  // Load messages when the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
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
  }, [activeId, scrollToBottom]);

  const refreshConversations = useCallback(() => {
    chatApi.conversations().then(({ data }) => setConversations(data)).catch(() => {});
  }, []);

  const startNewChat = useCallback(() => {
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
    setActiveId(data.id);
    setConversations((prev) => [data, ...prev]);
    return data.id;
  }, [activeId, i18n.language]);

  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || sending) return;
      setSending(true);
      setInput("");
      resetInputHeight();

      // Optimistically show the user's message.
      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setStreamingText("");
      setStreamingSources([]);
      setRelatedQuestions([]);
      scrollToBottom();

      try {
        const convId = await ensureConversation();
        const result = await streamMessage(convId, content, i18n.language, {
          onDelta: (delta) => {
            // Ignore chunks if the user switched conversations mid-stream.
            if (activeIdRef.current !== convId) return;
            setStreamingText((prev) => (prev ?? "") + delta);
            scrollToBottom();
          },
          onSources: (srcs) => {
            if (activeIdRef.current !== convId) return;
            setStreamingSources(srcs); // B2
          },
        });
        // Commit the final assistant message only if this conversation is still
        // on screen; otherwise it is already persisted and reloads on return.
        if (activeIdRef.current === convId) {
          setMessages((prev) => [
            ...prev,
            {
              id: result.assistantMessageId ?? `a-${Date.now()}`,
              role: "assistant",
              content: result.content,
              sources: result.sources || [],
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamingText(null);
          setStreamingSources([]);
          // R5 — fetch related catalog questions for the just-asked message.
          // Same activeId guard as the commit above: a mid-flight conversation
          // switch must not attach stale chips to the wrong chat. Degrade
          // silently to no chips on any error.
          fetchRelated(content, i18n.language)
            .then((qs) => {
              if (activeIdRef.current === convId) setRelatedQuestions(qs);
            })
            .catch(() => {
              if (activeIdRef.current === convId) setRelatedQuestions([]);
            });
        }
        refreshConversations();
      } catch {
        if (activeIdRef.current === convId) {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: t("errors.loadChat"),
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamingText(null);
        }
      } finally {
        setSending(false);
        scrollToBottom();
      }
    },
    [sending, ensureConversation, i18n.language, refreshConversations, scrollToBottom, resetInputHeight, t]
  );

  // Pre-fill from "Ask the AI about this" (scenario detail) — runs once.
  useEffect(() => {
    if (prefillConsumed.current) return;
    const prefill = location.state?.prefill;
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
      if (!window.confirm(t("chat.deleteConfirm"))) return;
      await chatApi.deleteConversation(id).catch(() => {});
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) startNewChat();
    },
    [activeId, startNewChat, t]
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

  return (
    <div className="chat-layout">
      {sidebarOpen && (
        <div className="chat-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={sidebarOpen ? "chat-sidebar open" : "chat-sidebar"}>
        <button type="button" className="btn btn-primary btn-block" onClick={startNewChat}>
          + {t("chat.newChat")}
        </button>
        <h2 className="sidebar-title">{t("chat.conversations")}</h2>
        <ul className="conv-list">
          {conversations.length === 0 && (
            <li className="conv-empty">{t("chat.noConversations")}</li>
          )}
          {conversations.map((c) => (
            <li
              key={c.id}
              className={c.id === activeId ? "conv-item active" : "conv-item"}
              onClick={() => openConversation(c.id)}
            >
              <span className="conv-title">{c.title || t("chat.newChat")}</span>
              <button
                type="button"
                className="conv-del"
                aria-label={t("common.delete")}
                onClick={(e) => deleteConversation(c.id, e)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat-main">
        <div className="chat-mobilebar">
          <button
            type="button"
            className="chat-sidebar-toggle"
            aria-label={t("chat.conversations")}
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="chat-mobilebar-title">{t("chat.conversations")}</span>
          {canExport && (
            <button
              type="button"
              className="chat-export-btn"
              onClick={exportConversation}
              aria-label={t("chat.export")}
              title={t("chat.export")}
            >
              ⬇
            </button>
          )}
        </div>
        <div className="chat-messages" ref={scrollRef}>
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
            <>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  sources={m.sources}
                  messageId={typeof m.id === "number" ? m.id : undefined}
                  feedback={m.feedback}
                  onFeedback={submitFeedback}
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
            </>
          )}
        </div>

        <form className="chat-input-bar" onSubmit={onSubmit}>
          <span className="lang-indicator" title={t("common.language")}>
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
              title={t("chat.voiceInput")}
            >
              🎤
            </button>
          )}
          <button
            type="submit"
            className="chat-send"
            disabled={sending || !input.trim()}
            aria-label={t("common.send")}
          >
            {sending ? "…" : "↑"}
          </button>
        </form>
      </section>
    </div>
  );
}
