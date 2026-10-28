import { createContext, useContext, useEffect, useState } from "react";

import { configApi } from "../api/endpoints";

/**
 * Public feature flags from ``GET /api/config/`` (guest chat, AI mode, …).
 *
 * Defaults are the safe ones (guest chat off) so the UI never advertises a feature the
 * backend hasn't enabled — including while the API is cold-starting or unreachable.
 */
const DEFAULTS = { guest_chat: false, chat_mode: "ai", ai_mode: "live", telegram_bot: false, loaded: false };

const ConfigContext = createContext(DEFAULTS);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);

  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then(({ data }) => active && setConfig({ ...DEFAULTS, ...data, loaded: true }))
      .catch(() => active && setConfig({ ...DEFAULTS, loaded: true }));
    return () => {
      active = false;
    };
  }, []);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
