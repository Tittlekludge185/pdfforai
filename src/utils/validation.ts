import fs from "node:fs";
import path from "node:path";

const MAX_FILE_SIZE = 1_000_000_000; // 1GB

export function validatePdfPath(filePath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return { success: false, error: `Not a file: ${filePath}` };
    }

    if (stat.size > MAX_FILE_SIZE) {
      return { success: false, error: "File size exceeds 1GB limit." };
    }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EPERM") {
      return {
        success: false,
        error:
          `Permission denied: ${filePath}\n\n` +
          `On macOS, your terminal needs access to this folder.\n` +
          `Go to: System Settings → Privacy & Security → Full Disk Access\n` +
          `and enable your terminal app (Terminal, iTerm2, Warp, etc.).`,
      };
    }
    throw err;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".pdf") {
    return { success: false, error: `Not a PDF file: ${filePath}` };
  }

  return { success: true };
}
