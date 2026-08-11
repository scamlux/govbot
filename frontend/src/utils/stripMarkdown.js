// Turn a snippet of Markdown into plain text for previews (catalog excerpts,
// meta descriptions). The Scenario body is Markdown, so a raw excerpt leaks
// syntax like "## Heading" and "**bold**" into card previews. This removes the
// common inline/block markers while keeping the readable text.
export function stripMarkdown(input) {
  if (!input) return "";
  return (
    input
      // fenced / inline code
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      // images ![alt](url) -> alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // headings, blockquotes, list bullets at line start
      .replace(/^\s{0,3}(#{1,6}|>|[-*+])\s+/gm, "")
      // ordered list markers "1. "
      .replace(/^\s{0,3}\d+\.\s+/gm, "")
      // bold / italic / strikethrough markers
      .replace(/(\*\*|__|~~|\*|_)/g, "")
      // horizontal rules
      .replace(/^\s*([-*_]\s*){3,}$/gm, " ")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}
