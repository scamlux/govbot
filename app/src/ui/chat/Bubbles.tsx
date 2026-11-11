import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import type { Source } from "../../api/types";
import { answeredInNote, splitBlocks, type Bubble } from "../../domain/chatReducer";
import { haptics } from "../../native/haptics";
import { hostOf, openInApp } from "../../native/browser";
import { useA11y } from "../../theme/a11y";
import { GirihMark } from "../Girih";
import { Icon } from "../icons";
import { Markdown } from "../Markdown";
import { useRise } from "../motion";
import { PressableScale } from "../PressableScale";
import { Skeleton } from "../Skeleton";
import { T } from "../primitives";

const CARET_MS = 500;

export function UserBubble({ content }: { content: string }) {
  const rise = useRise(0, 6, 220);
  return (
    <Animated.View entering={rise} style={{ alignSelf: "flex-end", maxWidth: "82%", paddingVertical: 12, paddingHorizontal: 15, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6, backgroundColor: "#1D1D1F" }}>
      <T color="#FFFFFF" selectable style={{ fontSize: 16, lineHeight: 22 }}>{content}</T>
    </Animated.View>
  );
}

/** Blinking text caret shown at the end of a streaming reply. */
export function Caret() {
  const { palette, reduceMotion } = useA11y();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return undefined;
    opacity.value = withRepeat(withSequence(withDelay(CARET_MS, withTiming(0, { duration: 1 })), withDelay(CARET_MS, withTiming(1, { duration: 1 }))), -1, false);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: 2, height: 18, marginTop: 2, backgroundColor: palette.accent }, style]} />;
}

/** One markdown block of a streaming answer: fades + rises 4px over 120ms when it first appears. */
function Block({ text }: { text: string }) {
  const rise = useRise(0, 4, 120);
  return (
    <Animated.View entering={rise}>
      <Markdown>{text}</Markdown>
    </Animated.View>
  );
}

function SourceChip({ source, index }: { source: Source; index: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useA11y();
  const rise = useRise(index * 60, 8, 300);
  useEffect(() => {
    if (index === 0) void haptics.light();
  }, [index]);
  const isCatalog = Boolean(source.slug) && source.origin !== "web";
  const sub = isCatalog ? (source.source_url ? hostOf(source.source_url) : t("trust.originCatalog")) : hostOf(source.source_url);
  const open = () => {
    if (isCatalog) router.push({ pathname: "/scenario/[slug]", params: { slug: source.slug, title: source.title } });
    else if (source.source_url) void openInApp(source.source_url, palette.accent);
  };
  return (
    <Animated.View entering={rise}>
      <PressableScale
        scaleTo={0.97}
        onPress={open}
        onLongPress={() => source.source_url && void openInApp(source.source_url, palette.accent)}
        accessibilityRole="link"
        accessibilityLabel={`${source.title}, ${sub}`}
        accessibilityHint={t("m.chat.openSource")}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: palette.surface, minHeight: 48, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 1 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: index % 2 === 0 ? palette.accent : palette.gold, alignItems: "center", justifyContent: "center" }}>
            <T size={12} weight="800" color={index % 2 === 0 ? "#FFFFFF" : "#1D1D1F"}>{String(index + 1)}</T>
          </View>
          <View style={{ maxWidth: 180 }}>
            <T size={13} weight="700" numberOfLines={1}>{sub || source.title}</T>
            <T size={12} muted numberOfLines={1}>{source.title}</T>
          </View>
          {source.source_url ? <Icon name="link" size={14} color={palette.muted} /> : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export function SourceChips({ sources }: { sources: readonly Source[] }) {
  const { t } = useTranslation();
  if (sources.length === 0) return null;
  return (
    <View accessibilityLabel={t("m.chat.sourcesTitle")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {sources.map((source, i) => (
        <SourceChip key={`${source.slug}-${i}`} source={source} index={i} />
      ))}
    </View>
  );
}

export interface AssistantBubbleProps {
  bubble: Bubble;
  uiLanguage: string;
  speaking: boolean;
  copied: boolean;
  onSpeak: () => void;
  onCopy: () => void;
  onThumbUp: () => void;
  onThumbDown: () => void;
  canRate: boolean;
}

function ActionButton({ icon, label, onPress, active, text }: { icon: "speaker" | "copy" | "thumbUp" | "thumbDown" | "check"; label: string; onPress: () => void; active?: boolean; text?: string }) {
  const { palette } = useA11y();
  return (
    <PressableScale onPress={onPress} haptic="selection" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={{ minHeight: 36, minWidth: 36, paddingHorizontal: text ? 12 : 8, borderRadius: 999, backgroundColor: active ? palette.accentTint : palette.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <Icon name={icon} size={16} color={active ? palette.accentPressed : palette.ink} strokeWidth={2} />
      {text ? <T size={13} weight="600" color={active ? palette.accentPressed : palette.ink}>{text}</T> : null}
    </PressableScale>
  );
}

export function AssistantBubble({ bubble, uiLanguage, speaking, copied, onSpeak, onCopy, onThumbUp, onThumbDown, canRate }: AssistantBubbleProps) {
  const { t } = useTranslation();
  const blocks = useMemo(() => splitBlocks(bubble.content), [bubble.content]);
  const note = answeredInNote(bubble.language, uiLanguage);
  const finished = !bubble.streaming && bubble.content.length > 0;
  const rating = bubble.feedback?.rating;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View accessibilityElementsHidden style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
        <GirihMark size={18} stroke={3} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
        {blocks.map((text, i) => (
          <Block key={i} text={text} />
        ))}
        {bubble.streaming ? (
          <View style={{ gap: 10 }}>
            {bubble.content ? <Caret /> : null}
            {bubble.sources.length === 0 ? (
              <View style={{ alignSelf: "flex-start", borderRadius: 999, overflow: "hidden", paddingVertical: 6, paddingHorizontal: 12 }}>
                <Skeleton height={32} radius={16} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
                <T size={13} weight="600" color="#3A3A3C">{t("m.chat.checkingSources")}</T>
              </View>
            ) : null}
          </View>
        ) : null}
        <SourceChips sources={bubble.sources} />
        {note && finished ? <T variant="footnote" muted>{t("m.chat.answeredIn", { language: note.toUpperCase() })}</T> : null}
        {finished ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton icon="speaker" label={speaking ? t("chat.stopReading") : t("m.chat.readAloud")} text={t("m.chat.readAloud")} active={speaking} onPress={onSpeak} />
            <ActionButton icon={copied ? "check" : "copy"} label={t("m.chat.copy")} onPress={onCopy} active={copied} />
            {canRate ? (
              <>
                <ActionButton icon="thumbUp" label={t("chat.feedbackUp")} onPress={onThumbUp} active={rating === "up"} />
                <ActionButton icon="thumbDown" label={t("chat.feedbackDown")} onPress={onThumbDown} active={rating === "down"} />
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
