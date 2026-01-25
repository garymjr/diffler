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

function binaryDiffMessage(diff: string): string | null {
  if (!diff) return null;
  if (diff.includes("GIT binary patch")) return "Binary diff not shown.";
  if (diff.includes("Binary files ") && diff.includes(" differ")) return "Binary diff not shown.";
  return null;
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

type LoadOptions = {
  stagedOnly?: boolean;
};

function parseStatus(output: string, options: LoadOptions = {}) {
  const stagedOnly = options.stagedOnly ?? false;
  const map = new Map<string, Pick<ChangeItem, "status" | "oldPath">>();
  if (!output) return map;
  const entries = output.split("\0").filter(Boolean);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 3) continue;
    const statusField = entry.slice(0, 2);
    const spaceIndex = entry.indexOf(" ", 2);
    if (spaceIndex === -1) continue;
    const path = entry.slice(spaceIndex + 1);
    const statusLetters = statusField.replace(/[0-9]/g, "");
    const x = statusLetters[0] ?? " ";
    const y = statusLetters[1] ?? " ";
    if (stagedOnly && (x === " " || x === "?")) continue;
    const { status, needsExtraPath } = statusFromXY(x, y);
    if (!status) continue;

    if (needsExtraPath) {
      const newPath = entries[index + 1];
      if (newPath) {
        map.set(newPath, { status, oldPath: path });
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

export function loadChanges(
  setError: (value: string | null) => void,
  options: LoadOptions = {}
): ChangeItem[] {
  const stagedOnly = options.stagedOnly ?? false;
  const repoCheck = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (repoCheck.exitCode !== 0 || repoCheck.stdout.trim() !== "true") {
    setError("Not inside a git repository.");
    return [];
  }

  const workingDiff = stagedOnly ? "" : runGit(["diff", "--patch", "--no-color"]).stdout;
  const stagedDiff = runGit(["diff", "--cached", "--patch", "--no-color"]).stdout;
  const statusMap = parseStatus(
    runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout,
    { stagedOnly }
  );

  const diffLookup = new Map<string, ChangeItem>();
  const diffPrimary = new Map<string, ChangeItem>();
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
        const entry: ChangeItem = {
          path: file.name,
          status,
          oldPath: file.prevName ?? undefined,
          hunks: file.hunks.length,
        };
        if (!diffPrimary.has(file.name)) {
          diffPrimary.set(file.name, entry);
        }
        if (!diffLookup.has(file.name)) {
          diffLookup.set(file.name, entry);
        }
        if (file.prevName && !diffLookup.has(file.prevName)) {
          diffLookup.set(file.prevName, entry);
        }
      }
    }
  }

  const items = new Map<string, ChangeItem>();

  for (const [filePath, statusInfo] of statusMap.entries()) {
    const diffInfo =
      diffLookup.get(filePath) ??
      (statusInfo.oldPath ? diffLookup.get(statusInfo.oldPath) : undefined);
    items.set(filePath, {
      path: filePath,
      status: statusInfo.status,
      oldPath: statusInfo.oldPath ?? diffInfo?.oldPath,
      hunks: diffInfo?.hunks,
    });
  }

  for (const [filePath, diffInfo] of diffPrimary.entries()) {
    if (items.has(filePath)) continue;
    items.set(filePath, diffInfo);
  }

  setError(null);
  return Array.from(items.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export function getRepoRoot(): string | null {
  const repoCheck = runGit(["rev-parse", "--show-toplevel"]);
  if (repoCheck.exitCode !== 0) return null;
  const root = repoCheck.stdout.trim();
  return root.length > 0 ? root : null;
}

export function loadDiff(change: ChangeItem, options: LoadOptions = {}): DiffData {
  const stagedOnly = options.stagedOnly ?? false;
  const diffParts: string[] = [];

  if (change.status === "untracked") {
    if (stagedOnly) {
      return {
        diff: "",
        language: resolveLanguage(change.path),
        added: 0,
        deleted: 0,
        message: "Untracked file is not staged.",
      };
    }
    const noIndex = runGit(["diff", "--no-index", "--patch", "--no-color", "--", "/dev/null", change.path]).stdout;
    if (noIndex.trim().length > 0) {
      diffParts.push(noIndex);
    }
  } else {
    const unstaged = stagedOnly ? "" : runGit(["diff", "--patch", "--no-color", "--", change.path]).stdout;
    const staged = runGit(["diff", "--cached", "--patch", "--no-color", "--", change.path]).stdout;
    if (unstaged.trim().length > 0) diffParts.push(unstaged);
    if (staged.trim().length > 0) diffParts.push(staged);
  }

  const diff = diffParts.join("\n");
  const message = binaryDiffMessage(diff);
  const safeDiff = message ? "" : diff;
  let added = 0;
  let deleted = 0;

  for (const line of safeDiff.split("\n")) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+")) {
      added += 1;
    } else if (line.startsWith("-")) {
      deleted += 1;
    }
  }

  return {
    diff: safeDiff,
    language: resolveLanguage(change.path),
    added,
    deleted,
    message: message ?? undefined,
  };
}
