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
        ) : pending && !content ? (
          <TypingDots label={t("common.loading")} />
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
        {sources.map((s, i) => (
          <SourceChip
            key={`${s.type || "scenario"}-${s.slug || s.source_url || s.url || i}`}
            source={s}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A single citation chip. Renders by source type:
 *  - scenario (or legacy, no type): internal link to /scenarios/{slug} + external ↗;
 *  - kb: external link to the official source only (KB chunks have no catalog slug);
 *  - web (C3): external link + a "live search" badge.
 */
function SourceChip({ source }) {
  const { t } = useTranslation();
  const type = source.type || "scenario";
  const title = source.title || source.slug || source.source_url || source.url || "";

  if (type === "scenario" && source.slug) {
    return (
      <span className="source-chip">
        <Link className="source-chip-link" to={`/scenarios/${source.slug}`}>
          {title}
        </Link>
        {source.source_url && (
          <a
            className="source-chip-ext"
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("chat.officialSourceLabel", { title })}
          >
            ↗
          </a>
        )}
      </span>
    );
  }

  const href = source.source_url || source.url;
  return (
    <span className="source-chip">
      {href ? (
        <a className="source-chip-link" href={href} target="_blank" rel="noopener noreferrer">
          {title}
        </a>
      ) : (
        <span className="source-chip-link">{title}</span>
      )}
      {type === "web" && <span className="source-chip-badge">{t("chat.liveBadge")}</span>}
    </span>
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

/** "Assistant is typing" indicator: three brand-colored dots pulsing in sequence. */
function TypingDots({ label }) {
  return (
    <div className="typing-dots" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}
