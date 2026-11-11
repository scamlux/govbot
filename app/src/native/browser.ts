import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

import { colors } from "../theme/tokens";

const SAFE_SCHEME = /^https?:\/\//i;

/** Open an http(s) URL in the in-app browser (Custom Tabs / SFSafariViewController). Other schemes go to Linking. */
export async function openInApp(url: string, accent: string = colors.accent): Promise<void> {
  if (!url) return;
  if (!SAFE_SCHEME.test(url)) {
    await Linking.openURL(url).catch(() => undefined);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, { toolbarColor: "#FFFFFF", controlsColor: accent, showTitle: true, enableBarCollapsing: true });
  } catch {
    await Linking.openURL(url).catch(() => undefined);
  }
}

/** Display host for source chips, e.g. "my.gov.uz". */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
