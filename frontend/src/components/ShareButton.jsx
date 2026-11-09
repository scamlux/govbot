import { useState } from "react";
import { useTranslation } from "react-i18next";

import Icon from "./Icon";
import { canShare, hapticTap, shareText } from "../native/bridge";

/**
 * Share action. Rendered only when the native shell or the Web Share API exists —
 * elsewhere the page already offers copy. `compact` is the icon-only chat variant.
 */
export default function ShareButton({ title, text, url, compact = false }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  if (!canShare()) return null;

  const share = async () => {
    hapticTap();
    const result = await shareText({ title, text, url });
    setFailed(result === "failed");
  };

  const Wrapper = compact ? "span" : "div";
  return (
    <Wrapper className={compact ? "msg-tools" : "detail-share-row"}>
      <button
        type="button"
        className={compact ? "fb-btn" : "btn btn-outline"}
        onClick={share}
        aria-label={t("native.share")}
      >
        <Icon name="share" size={18} />
        {!compact && <> {t("native.share")}</>}
      </button>
      {failed && (
        <span className="reminder-help" role="status">
          {t("native.shareFailed")}
        </span>
      )}
    </Wrapper>
  );
}
