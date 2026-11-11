import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { LinearTransition, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { chatApi } from "../../src/api/endpoints";
import type { ConversationSummary } from "../../src/api/types";
import { useAuth } from "../../src/auth/AuthProvider";
import { bucketFor, formatTime, weekdayShort, type DateBucket } from "../../src/domain/dates";
import { useLang } from "../../src/i18n/useLang";
import { haptics } from "../../src/native/haptics";
import { queryKeys } from "../../src/query/client";
import { useConfig, useConversations } from "../../src/query/hooks";
import { useA11y } from "../../src/theme/a11y";
import { families, type FamilyName } from "../../src/theme/tokens";
import { Icon } from "../../src/ui/icons";
import { LargeTitleScreen } from "../../src/ui/LargeTitleScreen";
import { PressableScale } from "../../src/ui/PressableScale";
import { Button, Eyebrow, Group, SearchField, T } from "../../src/ui/primitives";
import { SkeletonList } from "../../src/ui/Skeleton";
import { EmptyState, ErrorState, OfflineBanner } from "../../src/ui/States";
import { useTabBarSpace } from "../../src/ui/TabBar";

const FAMILY_CYCLE: FamilyName[] = ["teal", "gold", "lapis", "pomegranate"];
const BUCKETS: DateBucket[] = ["today", "week", "earlier"];
const DELETE_WIDTH = 88;

function ConversationRow({ item, last, onDelete }: { item: ConversationSummary; last: boolean; onDelete: (id: number) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const lang = useLang();
  const { palette } = useA11y();
  const ref = useRef<SwipeableMethods>(null);
  const family = families[FAMILY_CYCLE[item.id % FAMILY_CYCLE.length]];
  const bucket = bucketFor(item.updated_at);
  const stamp = bucket === "today" ? formatTime(item.updated_at, lang) : bucket === "week" ? weekdayShort(item.updated_at, lang) : new Date(item.updated_at).toLocaleDateString();

  const confirm = () => {
    void haptics.warning();
    Alert.alert(t("m.history.deleteTitle"), t("m.history.deleteBody"), [
      { text: t("m.common.cancel"), style: "cancel", onPress: () => ref.current?.close() },
      { text: t("m.history.delete"), style: "destructive", onPress: () => onDelete(item.id) },
    ]);
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={DELETE_WIDTH / 2}
      overshootRight={false}
      onSwipeableOpen={confirm}
      renderRightActions={() => (
        <View style={{ width: DELETE_WIDTH, backgroundColor: palette.danger, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Icon name="trash" size={20} color="#FFFFFF" />
          <T size={13} weight="700" color="#FFFFFF">{t("m.history.delete")}</T>
        </View>
      )}
    >
      <PressableScale
        scaleTo={0.99}
        haptic="selection"
        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: String(item.id) } })}
        accessibilityRole="button"
        accessibilityLabel={`${item.title || "GovBot"}, ${t("m.history.messages", { count: item.message_count })}`}
        style={{ backgroundColor: palette.surface }}
      >
        <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: "#F0F0F3" }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: family.tint, alignItems: "center", justifyContent: "center" }}>
            <Icon name="chat" size={20} color={family.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <T variant="callout" weight="700" numberOfLines={1}>{item.title || "GovBot"}</T>
            <T variant="subhead" muted numberOfLines={1}>{t("m.history.messages", { count: item.message_count })}</T>
          </View>
          <T variant="footnote" muted>{stamp}</T>
        </View>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

export default function History() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { palette } = useA11y();
  const config = useConfig();
  const conversations = useConversations();
  const tabSpace = useTabBarSpace();
  const [query, setQuery] = useState("");

  const guestChat = config.data?.guest_chat === true;
  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (conversations.data ?? [])
      .filter((c) => !needle || (c.title || "").toLowerCase().includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return BUCKETS.map((bucket) => ({ bucket, items: list.filter((c) => bucketFor(c.updated_at) === bucket) })).filter((g) => g.items.length > 0);
  }, [conversations.data, query]);

  const startNew = () => {
    void haptics.light();
    if (!user && !guestChat) router.push("/auth");
    else router.push({ pathname: "/chat/[id]", params: { id: "new" } });
  };

  const remove = async (id: number) => {
    const before = queryClient.getQueryData<ConversationSummary[]>(queryKeys.conversations);
    queryClient.setQueryData<ConversationSummary[]>(queryKeys.conversations, (old) => (old ?? []).filter((c) => c.id !== id));
    try {
      await chatApi.deleteConversation(id);
    } catch {
      queryClient.setQueryData(queryKeys.conversations, before);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LargeTitleScreen title={t("m.history.title")} onRefresh={user ? () => conversations.refetch() : undefined} top={<OfflineBanner />}>
        {!user ? (
          <View style={{ gap: 12 }}>
            <EmptyState icon="chat" title={t("m.history.guestTitle")} body={t("m.history.guestBody")} />
            <Button label={t("m.profile.signInCta")} onPress={() => router.push("/auth")} />
            {guestChat ? <Button tone="plain" label={t("m.chat.guestTry")} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: "guest" } })} /> : null}
          </View>
        ) : (
          <>
            <SearchField value={query} onChangeText={setQuery} placeholder={t("m.history.search")} />
            {conversations.isError && !conversations.data ? (
              <ErrorState onRetry={() => void conversations.refetch()} />
            ) : conversations.data === undefined ? (
              <SkeletonList count={4} />
            ) : grouped.length === 0 ? (
              <EmptyState
                icon="chat"
                title={query ? t("m.history.noMatch") : t("m.history.empty")}
                body={query ? undefined : t("m.history.emptyBody")}
                cta={query ? undefined : t("m.chat.newConversation")}
                onCta={query ? undefined : startNew}
              />
            ) : (
              grouped.map(({ bucket, items }) => (
                <View key={bucket} style={{ gap: 8 }}>
                  <Eyebrow>{t(`m.history.${bucket}`)}</Eyebrow>
                  <Group>
                    {items.map((item, index) => (
                      <Animated.View key={item.id} layout={LinearTransition.springify().damping(22).stiffness(140)} exiting={FadeOut.duration(150)}>
                        <ConversationRow item={item} last={index === items.length - 1} onDelete={(id) => void remove(id)} />
                      </Animated.View>
                    ))}
                  </Group>
                </View>
              ))
            )}
          </>
        )}
      </LargeTitleScreen>
      <View pointerEvents="box-none" style={{ position: "absolute", right: 18, bottom: tabSpace - 8 }}>
        <PressableScale
          onPress={startNew}
          accessibilityRole="button"
          accessibilityLabel={t("m.chat.newConversation")}
          style={{
            minHeight: 54,
            paddingHorizontal: 20,
            borderRadius: 20,
            backgroundColor: palette.accent,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            shadowColor: palette.accent,
            shadowOpacity: 0.35,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 16 },
            elevation: 8,
          }}
        >
          <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.4} />
          <T variant="callout" weight="700" color="#FFFFFF">{t("m.chat.newConversation")}</T>
        </PressableScale>
      </View>
    </View>
  );
}
