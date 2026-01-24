import { getFiletypeFromFileName } from "@pierre/diffs";
import path from "node:path";

const languageByExtension: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".go": "go",
  ".rs": "rust",
  ".py": "python",
  ".sh": "bash",
};

export function resolveLanguage(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && languageByExtension[ext]) {
    return languageByExtension[ext];
  }
  const lang = getFiletypeFromFileName(filePath);
  if (!lang || lang === "text" || lang === "ansi") {
    return undefined;
  }
  return lang;
}
