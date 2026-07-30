import { useTranslation } from "react-i18next";

/**
 * R5 — "Related questions" suggestion chips shown under an assistant reply.
 * Renders up to 3 clickable chips; picking one re-asks that question via `onPick`.
 * Renders nothing when there are no items, so the caller can mount it unconditionally.
 */
export default function RelatedQuestions({ items = [], onPick }) {
  const { t } = useTranslation();
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="related-questions">
      <span className="related-questions-label">{t("chat.relatedTitle")}</span>
      <div className="related-questions-chips">
        {items.slice(0, 3).map((q) => (
          <button
            key={q.slug || q.title}
            type="button"
            className="chip"
            onClick={() => onPick?.(q.title)}
          >
            {q.title}
          </button>
        ))}
      </div>
    </div>
  );
}
