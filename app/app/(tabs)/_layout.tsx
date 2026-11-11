import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { useA11y } from "../../src/theme/a11y";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { palette } = useA11y();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.line },
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 13, paddingVertical: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("m.tabs.home") }} />
      <Tabs.Screen name="chat" options={{ title: t("m.tabs.chat") }} />
      <Tabs.Screen name="catalog" options={{ title: t("m.tabs.catalog") }} />
      <Tabs.Screen name="cases" options={{ title: t("m.tabs.cases") }} />
      <Tabs.Screen name="profile" options={{ title: t("m.tabs.profile") }} />
    </Tabs>
  );
}
