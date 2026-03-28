/**
 * Converts Markdown to plain text by stripping formatting syntax
 * while preserving readable structure (paragraphs, list markers, spacing).
 */
export function markdownToPlainText(markdown: string): string {
  return (
    markdown
      // Remove code fences but keep content
      .replace(/```[\s\S]*?```/g, (match) => {
        const lines = match.split("\n");
        return lines.slice(1, -1).join("\n");
      })
      // Remove inline code backticks
      .replace(/`([^`]+)`/g, "$1")
      // Remove heading markers but keep text
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold+italic combined (**_text_** or ***text***)
      .replace(/\*{2,3}_?(.*?)_?\*{2,3}/g, "$1")
      // Remove bold
      .replace(/\*\*(.*?)\*\*/g, "$1")
      // Remove italic (underscores)
      .replace(/(?<!\w)_(.*?)_(?!\w)/g, "$1")
      // Remove italic (single asterisks)
      .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "$1")
      // Convert links: [text](url) → text (url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      // Remove images: ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Remove horizontal rules
      .replace(/^-{3,}$/gm, "")
      // Clean up watermark markdown link but keep text
      .replace(/\*Converted with \[pdfforai\.com\]\(https:\/\/pdfforai\.com\)\*/g, "Converted with pdfforai.com")
      // Remove any remaining emphasis markers
      .replace(/^>\s?/gm, "")
      // Collapse 3+ blank lines to 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
