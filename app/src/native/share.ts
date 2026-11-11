import { Share } from "react-native";

import type { ChatMessage, ConversationDetail } from "../api/types";

/** Markdown transcript, same shape as the web export (incl. sources). */
export function conversationToMarkdown(
  conversation: Pick<ConversationDetail, "title" | "messages">,
  labels: { you: string; assistant: string; sources: string },
): string {
  const lines = [`# ${conversation.title || "GovBot"}`, ""];
  conversation.messages.forEach((message: ChatMessage) => {
    lines.push(`**${message.role === "user" ? labels.you : labels.assistant}:**`, "", message.content, "");
    if (message.sources?.length) {
      lines.push(labels.sources, ...message.sources.map((s) => `- [${s.title}](${s.source_url})`), "");
    }
  });
  return lines.join("\n").trimEnd();
}

/** System share sheet; resolves true when the user completed a share. */
export async function shareText(message: string, title?: string): Promise<boolean> {
  const result = await Share.share({ message, title });
  return result.action === Share.sharedAction;
}
