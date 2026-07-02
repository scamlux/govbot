import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// D1 — a slim banner shown when the browser goes offline. The Scenario Catalog stays
// readable from the service worker cache; this just tells the user what's happening.
export default function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      {t("common.offline")}
    </div>
  );
}
