import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

export default function MessageBubble({ role, content, pending }) {
  const { t } = useTranslation();
  const isUser = role === "user";

  return (
    <div className={isUser ? "bubble-row user" : "bubble-row assistant"}>
      {!isUser && (
        <div className="bubble-avatar" aria-hidden="true">🏛️</div>
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
      </div>
    </div>
  );
}
