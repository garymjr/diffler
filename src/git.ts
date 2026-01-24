import { parsePatchFiles } from "@pierre/diffs";
import type { ChangeItem, ChangeStatus, DiffData } from "./types";
import { resolveLanguage } from "./language";

const decoder = new TextDecoder();

function runGit(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: process.cwd(),
  });
  return {
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
    exitCode: result.exitCode,
  };
}

function statusFromXY(x: string, y: string) {
  if (x === "!" || y === "!") return { status: null, needsExtraPath: false };
  if (x === "?" || y === "?") return { status: "untracked" as const, needsExtraPath: false };
  if (x === "U" || y === "U") return { status: "conflict" as const, needsExtraPath: false };
  if (x === "D" || y === "D") return { status: "deleted" as const, needsExtraPath: false };
  if (x === "A" || y === "A") return { status: "added" as const, needsExtraPath: false };
  if (x === "R" || y === "R") return { status: "renamed" as const, needsExtraPath: true };
  if (x === "C" || y === "C") return { status: "copied" as const, needsExtraPath: true };
  return { status: "modified" as const, needsExtraPath: false };
}

function parseStatus(output: string) {
  const map = new Map<string, Pick<ChangeItem, "status" | "oldPath">>();
  if (!output) return map;
  const entries = output.split("\0").filter(Boolean);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 3) continue;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    const { status, needsExtraPath } = statusFromXY(code[0], code[1]);
    if (!status) continue;

    if (needsExtraPath) {
      const oldPath = entries[index + 1];
      if (oldPath) {
        map.set(path, { status, oldPath });
        index += 1;
        continue;
      }
    }

    map.set(path, { status });
  }

  return map;
}

function mapChangeType(type: string | undefined): ChangeStatus {
  switch (type) {
    case "new":
      return "added";
    case "deleted":
      return "deleted";
    case "rename-pure":
    case "rename-changed":
      return "renamed";
    case "copy-pure":
    case "copy-changed":
      return "copied";
    default:
      return "modified";
  }
}

export function loadChanges(setError: (value: string | null) => void): ChangeItem[] {
  const repoCheck = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (repoCheck.exitCode !== 0 || repoCheck.stdout.trim() !== "true") {
    setError("Not inside a git repository.");
    return [];
  }

  const workingDiff = runGit(["diff", "--patch", "--no-color"]).stdout;
  const stagedDiff = runGit(["diff", "--cached", "--patch", "--no-color"]).stdout;
  const statusMap = parseStatus(
    runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout
  );

  const items = new Map<string, ChangeItem>();
  const diffs = [workingDiff, stagedDiff].filter((diff) => diff.trim().length > 0);

  for (const diffText of diffs) {
    let patches = [] as ReturnType<typeof parsePatchFiles>;
    try {
      patches = parsePatchFiles(diffText);
    } catch {
      continue;
    }

    for (const patch of patches) {
      for (const file of patch.files) {
        const status = mapChangeType(file.type);
        const existing = items.get(file.name);
        if (!existing) {
          items.set(file.name, {
            path: file.name,
            status,
            oldPath: file.prevName ?? undefined,
            hunks: file.hunks.length,
          });
        }
      }
    }
  }

  for (const [filePath, statusInfo] of statusMap.entries()) {
    const existing = items.get(filePath);
    if (existing) {
      if (statusInfo.oldPath) {
        existing.oldPath = statusInfo.oldPath;
      }
      if (statusInfo.status === "untracked") {
        existing.status = "untracked";
      }
      continue;
    }

    items.set(filePath, {
      path: filePath,
      status: statusInfo.status,
      oldPath: statusInfo.oldPath,
    });
  }

  setError(null);
  return Array.from(items.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export function loadDiff(change: ChangeItem): DiffData {
  const diffParts: string[] = [];

  if (change.status === "untracked") {
    const noIndex = runGit(["diff", "--no-index", "--patch", "--no-color", "--", "/dev/null", change.path]).stdout;
    if (noIndex.trim().length > 0) {
      diffParts.push(noIndex);
    }
  } else {
    const unstaged = runGit(["diff", "--patch", "--no-color", "--", change.path]).stdout;
    const staged = runGit(["diff", "--cached", "--patch", "--no-color", "--", change.path]).stdout;
    if (unstaged.trim().length > 0) diffParts.push(unstaged);
    if (staged.trim().length > 0) diffParts.push(staged);
  }

  const diff = diffParts.join("\n");
  let added = 0;
  let deleted = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+")) {
      added += 1;
    } else if (line.startsWith("-")) {
      deleted += 1;
    }
  }

  return {
    diff,
    language: resolveLanguage(change.path),
    added,
    deleted,
  };
}
