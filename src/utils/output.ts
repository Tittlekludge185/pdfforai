import fs from "node:fs";
import path from "node:path";

export type OutputFormat = "ai" | "markdown" | "text";

const WATERMARK_MD = "\n\n---\n*Converted with [pdfforai.com](https://pdfforai.com)*\n";
const WATERMARK_TEXT = "\n\n---\nConverted with pdfforai.com\n";
const WATERMARK_AI = "\n\n<footer>Converted with pdfforai.com</footer>\n";

export function withWatermark(content: string, format: OutputFormat = "markdown", enabled = true): string {
  if (!enabled) return content;
  if (format === "ai") return content + WATERMARK_AI;
  return content + (format === "text" ? WATERMARK_TEXT : WATERMARK_MD);
}

export function getOutputExtension(format: OutputFormat): string {
  switch (format) {
    case "markdown":
      return ".md";
    case "text":
    case "ai":
      return ".txt";
  }
}

export function writeOutputFile(content: string, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, content, "utf-8");
}

export async function writeZip(
  files: { name: string; content: string }[],
  outputPath: string,
  format: OutputFormat
): Promise<void> {
  const archiver = (await import("archiver")).default;
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    const ext = getOutputExtension(format);
    for (const file of files) {
      archive.append(file.content, { name: file.name.replace(/\.pdf$/i, ext) });
    }

    archive.finalize();
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
