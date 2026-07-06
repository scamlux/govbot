import { useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ThumbIcon = ({ down = false }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={down ? { transform: "scaleY(-1)" } : undefined}>
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);

const TIME_UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

function relativeTime(iso, lang) {
  if (!iso) return "";
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    for (const [unit, secs] of TIME_UNITS) {
      if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
    }
    return rtf.format(0, "minute");
  } catch {
    return "";
  }
}

function TypingDots({ label }) {
  return (
    <div className="typing-dots" role="status" aria-label={label}>
      <span /><span /><span />
    </div>
  );
}

export default function MessageBubble({
  id,
  role,
  content,
  createdAt,
  pending = false,
  sources = [],
  feedback = null,
  onFeedback,
}) {
  const { t, i18n } = useTranslation();
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");

  const rating = feedback?.rating ?? null;
  const canRate = !isUser && !pending && typeof id === "number" && !!onFeedback;
  const showSources = !isUser && !pending && sources.length > 0;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — nothing sensible to do */
    }
  };

  const rate = (value) => {
    if (value === "down") {
      setReasonOpen(true);
      onFeedback(id, "down", reason.trim());
    } else {
      setReasonOpen(false);
      onFeedback(id, "up", "");
    }
  };

  const sendReason = (e) => {
    e.preventDefault();
    onFeedback(id, "down", reason.trim());
    setReasonOpen(false);
  };

  return (
    <div className={isUser ? "bubble-row user" : "bubble-row assistant"}>
      {!isUser && (
        <div className="bubble-avatar" aria-hidden="true">🏛️</div>
      )}
      <div className="bubble">
        {isUser ? (
          <p className="bubble-plain">{content}</p>
        ) : pending && !content ? (
          <TypingDots label={t("chat.thinking")} />
        ) : (
          <div className="bubble-md markdown">
            <ReactMarkdown>{content || ""}</ReactMarkdown>
            {pending && <span className="cursor-blink" aria-hidden="true">▋</span>}
          </div>
        )}

        {showSources && (
          <div className="sources-row">
            <span className="sources-label">{t("chat.sources")}</span>
            {sources.map((s) => (
              <span className="source-chip" key={s.slug}>
                <Link to={`/scenarios/${s.slug}`} className="source-chip-main">
                  <LinkIcon />
                  <span className="source-chip-title">{s.title || s.slug}</span>
                </Link>
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-chip-ext"
                    aria-label={`${s.title || s.slug} — ${s.source_url}`}
                  >
                    <ExternalIcon />
                  </a>
                )}
              </span>
            ))}
          </div>
        )}

        {!pending && (
          <div className="bubble-actions">
            {canRate && (
              <div className="feedback-row">
                <button
                  type="button"
                  className={rating === "up" ? "fb-btn up active" : "fb-btn up"}
                  aria-label={t("chat.helpful")}
                  title={t("chat.helpful")}
                  aria-pressed={rating === "up"}
                  onClick={() => rate("up")}
                >
                  <ThumbIcon />
                </button>
                <button
                  type="button"
                  className={rating === "down" ? "fb-btn down active" : "fb-btn down"}
                  aria-label={t("chat.notHelpful")}
                  title={t("chat.notHelpful")}
                  aria-pressed={rating === "down"}
                  onClick={() => rate("down")}
                >
                  <ThumbIcon down />
                </button>
              </div>
            )}
            <div className="bubble-meta">
              <button
                type="button"
                className="bubble-copy"
                onClick={copyText}
                aria-label={copied ? t("chat.copied") : t("chat.copy")}
                title={copied ? t("chat.copied") : t("chat.copy")}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              {createdAt && (
                <span className="bubble-time">{relativeTime(createdAt, i18n.language)}</span>
              )}
            </div>
          </div>
        )}

        {canRate && reasonOpen && rating === "down" && (
          <form className="fb-reason" onSubmit={sendReason}>
            <input
              type="text"
              value={reason}
              maxLength={2000}
              placeholder={t("chat.feedbackReasonPlaceholder")}
              aria-label={t("chat.feedbackReasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="submit" className="btn btn-outline btn-sm">
              {t("chat.feedbackSend")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
