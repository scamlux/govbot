import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useA11y } from "../theme/a11y";
import { spacing } from "../theme/tokens";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { palette } = useA11y();
  const padding = { padding: spacing.lg, gap: spacing.md };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
