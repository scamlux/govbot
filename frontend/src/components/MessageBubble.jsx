import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * A single chat message.
 *
 * Assistant messages may additionally render:
 *  - source chips (B2) linking to the catalog entry + the official source_url;
 *  - 👍/👎 feedback controls (A2) when the message is persisted (numeric id).
 */
export default function MessageBubble({
  role,
  content,
  pending = false,
  sources = [],
  messageId,
  feedback = null,
  onFeedback,
}) {
  const { t } = useTranslation();
  const isUser = role === "user";
  const canRate =
    !isUser && !pending && typeof messageId === "number" && typeof onFeedback === "function";
  const hasSources = !isUser && Array.isArray(sources) && sources.length > 0;

  return (
    <div className={isUser ? "bubble-row user" : "bubble-row assistant"}>
      {!isUser && (
        <div className="bubble-avatar" aria-hidden="true" />
      )}
      <div className="bubble">
        <div className="bubble-author">
          {isUser ? t("chat.you") : t("chat.assistant")}
        </div>
        {isUser ? (
          <p className="bubble-plain">{content}</p>
        ) : (
          <div className="bubble-md markdown">
            <ReactMarkdown>{content || ""}</ReactMarkdown>
            {pending && <span className="cursor-blink" aria-hidden="true">▋</span>}
          </div>
        )}

        {hasSources && <Sources sources={sources} label={t("chat.sources")} />}
        {canRate && (
          <FeedbackBar
            feedback={feedback}
            onFeedback={(rating, reason) => onFeedback(messageId, rating, reason)}
          />
        )}
      </div>
    </div>
  );
}

function Sources({ sources, label }) {
  return (
    <div className="msg-sources">
      <span className="msg-sources-label">{label}</span>
      <div className="msg-sources-chips">
        {sources.map((s) => (
          <span className="source-chip" key={s.slug}>
            <Link className="source-chip-link" to={`/scenarios/${s.slug}`}>
              {s.title || s.slug}
            </Link>
            {s.source_url && (
              <a
                className="source-chip-ext"
                href={s.source_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title || s.slug} — official source`}
              >
                ↗
              </a>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeedbackBar({ feedback, onFeedback }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(feedback?.rating ?? null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState(feedback?.reason ?? "");

  const rate = (value) => {
    setRating(value);
    setShowReason(value === "down");
    onFeedback(value, value === "down" ? reason : "");
  };

  const submitReason = () => {
    setShowReason(false);
    onFeedback("down", reason);
  };

  return (
    <div className="msg-feedback">
      <button
        type="button"
        className={rating === "up" ? "fb-btn active" : "fb-btn"}
        aria-pressed={rating === "up"}
        aria-label={t("chat.feedbackUp")}
        onClick={() => rate("up")}
      >
        👍
      </button>
      <button
        type="button"
        className={rating === "down" ? "fb-btn active" : "fb-btn"}
        aria-pressed={rating === "down"}
        aria-label={t("chat.feedbackDown")}
        onClick={() => rate("down")}
      >
        👎
      </button>
      {showReason && (
        <span className="fb-reason">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("chat.feedbackReasonPlaceholder")}
            aria-label={t("chat.feedbackReasonPlaceholder")}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={submitReason}>
            {t("common.send")}
          </button>
        </span>
      )}
    </div>
  );
}
