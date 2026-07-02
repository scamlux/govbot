// D3 — export a conversation to a Markdown file, client-side (no server round-trip).
// Grounding sources (B1/B3) are included under each assistant answer.

function slugify(text) {
  return (
    (text || "conversation")
      .toLowerCase()
      .replace(/[^\wЀ-ӿ]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "conversation"
  );
}

export function conversationToMarkdown({ title, messages, sourcesLabel = "Sources" }) {
  const lines = [`# ${title || "Conversation"}`, ""];
  for (const m of messages) {
    const who = m.role === "user" ? "🧑 You" : "🏛️ GovBot";
    lines.push(`## ${who}`, "", m.content || "", "");
    if (m.role !== "user" && Array.isArray(m.sources) && m.sources.length > 0) {
      lines.push(`**${sourcesLabel}**`);
      for (const s of m.sources) {
        const link = s.source_url ? ` — ${s.source_url}` : "";
        lines.push(`- ${s.title || s.slug} (/scenarios/${s.slug})${link}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function exportConversationMarkdown({ title, messages, sourcesLabel }) {
  const markdown = conversationToMarkdown({ title, messages, sourcesLabel });
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
