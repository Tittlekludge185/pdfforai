import fs from "node:fs";
import path from "node:path";

const MAX_FILE_SIZE = 1_000_000_000; // 1GB

export function validatePdfPath(filePath: string): { success: boolean; error?: string } {
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

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".pdf") {
    return { success: false, error: `Not a PDF file: ${filePath}` };
  }

  return { success: true };
}
