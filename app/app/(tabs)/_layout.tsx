import { Tabs } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";

import { useA11y } from "../../src/theme/a11y";
import { TabBar } from "../../src/ui/TabBar";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { palette } = useA11y();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.bg }, animation: "fade" }}
    >
      <Tabs.Screen name="index" options={{ title: t("m.tabs.home") }} />
      <Tabs.Screen name="chat" options={{ title: t("m.tabs.chat") }} />
      <Tabs.Screen name="catalog" options={{ title: t("m.tabs.catalog") }} />
      <Tabs.Screen name="cases" options={{ title: t("m.tabs.cases") }} />
      <Tabs.Screen name="profile" options={{ title: t("m.tabs.profile") }} />
    </Tabs>
  );
}
