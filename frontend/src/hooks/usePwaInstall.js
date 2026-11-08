import { useCallback, useEffect, useState } from "react";

import { canPromptInstall, isIos, isStandalone, promptInstall, subscribeInstall } from "../utils/pwaInstall";

/**
 * State for the "Install app" card:
 *  - `installed`  already running as an installed app -> hide the card
 *  - `canPrompt`  the browser handed us beforeinstallprompt -> show an Install button
 *  - `ios`        iOS Safari -> show the static Share -> Add to Home Screen steps
 */
export function usePwaInstall() {
  const read = () => ({ installed: isStandalone(), canPrompt: canPromptInstall(), ios: isIos() });
  const [state, setState] = useState(read);

  useEffect(() => {
    setState(read());
    return subscribeInstall(() => setState(read()));
  }, []);

  const install = useCallback(() => promptInstall(), []);
  return { ...state, install };
}
