import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { chatApi } from "../../src/api/endpoints";
import { useAuth } from "../../src/auth/AuthProvider";
import { useLang } from "../../src/i18n/useLang";
import { queryKeys } from "../../src/query/client";
import { useConfig, useConversations } from "../../src/query/hooks";
import { Button, Card, T } from "../../src/ui/primitives";
import { QueryState } from "../../src/ui/QueryState";
import { Screen } from "../../src/ui/Screen";

export default function ChatTab() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const config = useConfig();
  const conversations = useConversations();

  const create = useMutation({
    mutationFn: () => chatApi.createConversation(lang),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      router.push({ pathname: "/chat/[id]", params: { id: String(conversation.id) } });
    },
  });

  if (!user) {
    return (
      <Screen>
        <T variant="largeTitle">{t("m.tabs.chat")}</T>
        <T muted>{t("m.chat.signInPrompt")}</T>
        <Button label={t("m.auth.signIn")} onPress={() => router.push("/auth")} />
        {config.data?.guest_chat ? (
          <Button
            tone="plain"
            label={t("m.chat.guestTry")}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: "guest" } })}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="largeTitle">{t("chat.conversations")}</T>
      <Button label={t("m.chat.newConversation")} onPress={() => create.mutate()} disabled={create.isPending} />
      <QueryState query={conversations}>
        {(items) =>
          items.length === 0 ? (
            <T muted>{t("chat.noConversations")}</T>
          ) : (
            items.map((conversation) => (
              <Link
                key={conversation.id}
                href={{ pathname: "/chat/[id]", params: { id: String(conversation.id) } }}
              >
                <Card>
                  <T variant="headline" numberOfLines={1}>
                    {conversation.title || t("chat.newChat")}
                  </T>
                  <T variant="footnote" muted>
                    {conversation.message_count}
                  </T>
                </Card>
              </Link>
            ))
          )
        }
      </QueryState>
    </Screen>
  );
}
