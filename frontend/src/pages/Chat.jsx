import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { chatApi, streamMessage } from "../api/endpoints";
import MessageBubble from "../components/MessageBubble";
import Modal from "../components/Modal";
import Toast from "../components/Toast";

// Client-side hint matching the backend's CHAT_MAX_MESSAGE_LENGTH default (S3).
const MAX_MESSAGE_LENGTH = 4000;

export default function Chat() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const prefillConsumed = useRef(false);
  const toastTimer = useRef(null);

  const showToast = useCallback((text, kind = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

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
      .catch(() => setConversations([]))
      .finally(() => setListLoading(false));
  }, []);

  // Load messages when active conversation changes.
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
    resetInputHeight();
    setSidebarOpen(false);
  }, [resetInputHeight]);

  const openConversation = useCallback((id) => {
    setActiveId(id);
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
      if (!content || sending || content.length > MAX_MESSAGE_LENGTH) return;
      setSending(true);
      setInput("");
      resetInputHeight();

      // Optimistically show user's message.
      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setStreamingText("");
      scrollToBottom();

      try {
        const convId = await ensureConversation();
        const result = await streamMessage(convId, content, i18n.language, {
          onDelta: (delta) => {
            setStreamingText((prev) => (prev ?? "") + delta);
            scrollToBottom();
          },
        });
        // Commit final assistant message (with its grounding sources, B1/B2).
        setMessages((prev) => [
          ...prev,
          {
            id: result.assistantMessageId ?? `a-${Date.now()}`,
            role: "assistant",
            content: result.content,
            sources: result.sources ?? [],
            created_at: new Date().toISOString(),
          },
        ]);
        setStreamingText(null);
        refreshConversations();
      } catch {
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

  const requestDelete = useCallback((id, e) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await chatApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) startNewChat();
      showToast(t("chat.deleted"));
    } catch {
      showToast(t("errors.delete"), "error");
    }
  }, [confirmDeleteId, activeId, startNewChat, showToast, t]);

  const submitFeedback = useCallback(
    async (messageId, rating, reason) => {
      try {
        const { data } = await chatApi.sendFeedback(messageId, rating, reason);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, feedback: data } : m))
        );
        if (rating === "up") showToast(t("chat.feedbackThanks"));
      } catch {
        showToast(t("errors.feedback"), "error");
      }
    },
    [showToast, t]
  );

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
  const overLimit = input.length > MAX_MESSAGE_LENGTH;
  const nearLimit = input.length > MAX_MESSAGE_LENGTH * 0.9;

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
          {listLoading &&
            [0, 1, 2, 3].map((i) => (
              <li key={i} className="conv-skeleton skeleton" aria-hidden="true" />
            ))}
          {!listLoading && conversations.length === 0 && (
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
                onClick={(e) => requestDelete(c.id, e)}
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
        </div>
        <div className="chat-messages" ref={scrollRef}>
          {loadingConv ? (
            <div className="messages-skeleton" aria-label={t("common.loading")}>
              <div className="msg-skeleton skeleton" />
              <div className="msg-skeleton skeleton wide" />
              <div className="msg-skeleton skeleton right" />
              <div className="msg-skeleton skeleton wide" />
            </div>
          ) : showEmpty ? (
            <div className="chat-empty">
              <div className="chat-empty-mark" aria-hidden="true">🏛️</div>
              <h2>{t("chat.emptyTitle")}</h2>
              <p>{t("chat.emptySubtitle")}</p>
              <div className="suggestions">
                {["suggestion1", "suggestion2", "suggestion3"].map((k, i) => (
                  <button
                    key={k}
                    type="button"
                    className="chip chip-stagger"
                    style={{ animationDelay: `${120 + i * 70}ms` }}
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
                  id={m.id}
                  role={m.role}
                  content={m.content}
                  createdAt={m.created_at}
                  sources={m.sources ?? []}
                  feedback={m.feedback ?? null}
                  onFeedback={submitFeedback}
                />
              ))}
              {streamingText !== null && (
                <MessageBubble role="assistant" content={streamingText} pending />
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
            placeholder={t("chat.placeholder")}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrowInput();
            }}
            onKeyDown={onKeyDown}
            aria-label={t("chat.placeholder")}
            aria-invalid={overLimit || undefined}
          />
          {nearLimit && (
            <span
              className={overLimit ? "chat-count over" : "chat-count"}
              title={t("chat.tooLong", { max: MAX_MESSAGE_LENGTH })}
            >
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
          <button
            type="submit"
            className="chat-send"
            disabled={sending || !input.trim() || overLimit}
            aria-label={t("common.send")}
          >
            {sending ? "…" : "↑"}
          </button>
        </form>
      </section>

      {confirmDeleteId !== null && (
        <Modal
          title={t("chat.deleteTitle")}
          onClose={() => setConfirmDeleteId(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDeleteId(null)}
              >
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmDelete}>
                {t("common.delete")}
              </button>
            </>
          }
        >
          <p>{t("chat.deleteBody")}</p>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}
