import MarkdownDisplay, { type RenderRules } from "@ronradtke/react-native-markdown-display";
import { useMemo } from "react";
import { View } from "react-native";

import { openInApp } from "../native/browser";
import { useA11y } from "../theme/a11y";
import { T } from "./primitives";

/** Themed markdown for scenario bodies and assistant replies. Numbered lists render as design "step" badges. */
export function Markdown({ children, fontSize = 16 }: { children: string; fontSize?: number }) {
  const { palette, appTextScale } = useA11y();
  const size = Math.round(fontSize * appTextScale);

  const style = useMemo(
    () => ({
      body: { color: palette.ink, fontSize: size, lineHeight: Math.round(size * 1.5) },
      paragraph: { marginTop: 0, marginBottom: 10 },
      heading1: { fontSize: size + 8, fontWeight: "800" as const, marginTop: 8, marginBottom: 8, color: palette.ink },
      heading2: { fontSize: size + 4, fontWeight: "800" as const, marginTop: 8, marginBottom: 6, color: palette.ink },
      heading3: { fontSize: size + 1, fontWeight: "700" as const, marginTop: 6, marginBottom: 4, color: palette.ink },
      strong: { fontWeight: "700" as const },
      link: { color: palette.accent, textDecorationLine: "underline" as const },
      bullet_list_icon: { color: palette.accent, fontSize: size, lineHeight: Math.round(size * 1.5), marginRight: 8 },
      list_item: { marginBottom: 6 },
      code_inline: { backgroundColor: "#F2F2F5", borderRadius: 6, paddingHorizontal: 4, fontFamily: "monospace" },
      blockquote: { backgroundColor: palette.accentTint, borderLeftWidth: 3, borderLeftColor: palette.accent, paddingHorizontal: 12, borderRadius: 8, marginVertical: 6 },
    }),
    [palette, size],
  );

  const rules = useMemo<RenderRules>(
    () => ({
      list_item: (node, kids, parents, styles) => {
        const ordered = parents.some((p) => p.type === "ordered_list");
        if (!ordered) {
          const bullet = parents.some((p) => p.type === "bullet_list");
          if (!bullet) return <View key={node.key}>{kids}</View>;
          return (
            <View key={node.key} style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <T color={palette.accent} style={{ marginRight: 8, lineHeight: Math.round(size * 1.5) }}>{"•"}</T>
              <View style={{ flex: 1 }}>{kids}</View>
            </View>
          );
        }
        const list = parents.find((p) => p.type === "ordered_list");
        const start = Number(list?.attributes?.start);
        const n = Number.isFinite(start) ? start + node.index : node.index + 1;
        return (
          <View key={node.key} style={[{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 }, styles.list_item as object]}>
            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: palette.accentTint, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              <T size={13} weight="800" color={palette.accentPressed}>{String(n)}</T>
            </View>
            <View style={{ flex: 1 }}>{kids}</View>
          </View>
        );
      },
    }),
    [palette, size],
  );

  return (
    <MarkdownDisplay
      style={style}
      rules={rules}
      onLinkPress={(url) => {
        void openInApp(url, palette.accent);
        return false;
      }}
    >
      {children}
    </MarkdownDisplay>
  );
}
