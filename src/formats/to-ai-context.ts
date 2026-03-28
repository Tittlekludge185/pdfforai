/**
 * Converts Markdown to an AI-optimized context format.
 *
 * Wraps the content in XML tags with metadata and framing instructions
 * so AI chatbots (ChatGPT, Claude, Gemini) treat it as structured
 * reference material.
 */

export interface AiContextOptions {
  fileName: string;
}

export function markdownToAiContext(markdown: string, options: AiContextOptions): string {
  const title = options.fileName.replace(/\.pdf$/i, "");

  const cleaned = markdown
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Remove bold+italic combined (**_text_** or ***text***)
    .replace(/\*{2,3}_?(.*?)_?\*{2,3}/g, "$1")
    // Remove bold
    .replace(/\*\*(.*?)\*\*/g, "$1")
    // Remove italic (underscores)
    .replace(/(?<!\w)_(.*?)_(?!\w)/g, "$1")
    // Remove italic (single asterisks)
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "$1")
    // Convert links: [text](url) → text (strip URL to save tokens)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove horizontal rules
    .replace(/^-{3,}$/gm, "")
    // Strip blockquote markers
    .replace(/^>\s?/gm, "")
    // Clean up watermark
    .replace(/\*Converted with \[pdfforai\.com\]\(https:\/\/pdfforai\.com\)\*/g, "")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const today = new Date().toISOString().split("T")[0];

  return `<document>
<metadata>
Title: ${title}
Words: ~${wordCount.toLocaleString()}
Converted: ${today} via pdfforai.com
</metadata>

<instructions>
This is the extracted text content of a PDF document. Reference it to answer questions accurately. When citing specific data, numbers, or quotes, indicate the section they come from.
</instructions>

<content>
${cleaned}
</content>
</document>`;
}
