import { getFiletypeFromFileName, parsePatchFiles } from "@pierre/diffs";
import type { ScrollBoxRenderable } from "@opentui/core";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, Show, onMount } from "solid-js";
import path from "node:path";

type ChangeStatus = "modified" | "added" | "deleted" | "renamed" | "untracked";

type ChangeItem = {
  path: string;
  status: ChangeStatus;
  oldPath?: string;
  hunks?: number;
};

type DiffData = {
  diff: string;
  language?: string;
  added: number;
  deleted: number;
};

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

function parseStatus(output: string) {
  const map = new Map<string, Pick<ChangeItem, "status" | "oldPath">>();
  const lines = output.split("\n").filter(Boolean);

  for (const line of lines) {
    const code = line.slice(0, 2);
    const rest = line.slice(3).trim();

    if (code === "??") {
      map.set(rest, { status: "untracked" });
      continue;
    }

    if (code.includes("R")) {
      const [oldPath, newPath] = rest.split(" -> ");
      if (newPath) {
        map.set(newPath, { status: "renamed", oldPath });
      }
    }
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
    default:
      return "modified";
  }
}

function loadChanges(setError: (value: string | null) => void): ChangeItem[] {
  const repoCheck = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (repoCheck.exitCode !== 0 || repoCheck.stdout.trim() !== "true") {
    setError("Not inside a git repository.");
    return [];
  }

  const workingDiff = runGit(["diff", "--patch", "--no-color"]).stdout;
  const stagedDiff = runGit(["diff", "--cached", "--patch", "--no-color"]).stdout;
  const statusMap = parseStatus(runGit(["status", "--porcelain"]).stdout);

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

function resolveLanguage(filePath: string) {
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

function statusLabel(status: ChangeStatus | undefined) {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "untracked":
      return "??";
    default:
      return "M";
  }
}

function statusColor(status: ChangeStatus | undefined) {
  switch (status) {
    case "added":
      return colors.green;
    case "deleted":
      return colors.red;
    case "untracked":
      return colors.yellow;
    default:
      return colors.blue;
  }
}

function loadDiff(change: ChangeItem): DiffData {
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

const colors = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  text: "#cdd6f4",
  subtext0: "#a6adc8",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
};

function App() {
  const renderer = useRenderer();
  const [error, setError] = createSignal<string | null>(null);
  const [changes, setChanges] = createSignal<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  let diffScroll: ScrollBoxRenderable | undefined;

  onMount(() => {
    setChanges(loadChanges(setError));
  });

  const fileEntries = createMemo(() => changes());
  const changeMap = createMemo(() => {
    const map = new Map<string, ChangeItem>();
    for (const change of changes()) {
      map.set(change.path, change);
    }
    return map;
  });

  const selectedIndex = createMemo(() => {
    const path = selectedPath();
    if (!path) return -1;
    return fileEntries().findIndex((entry) => entry.path === path);
  });
  const selectedFileName = createMemo(() => {
    const current = selectedPath();
    return current ? path.basename(current) : null;
  });
  const selectedChange = createMemo(() => {
    const current = selectedPath();
    return current ? changeMap().get(current) ?? null : null;
  });
  const hasMultipleFiles = createMemo(() => fileEntries().length > 1);
  const hasPrevFile = createMemo(() => hasMultipleFiles() && selectedIndex() > 0);
  const hasNextFile = createMemo(() => {
    const index = selectedIndex();
    return hasMultipleFiles() && index >= 0 && index < fileEntries().length - 1;
  });

  createEffect(() => {
    const files = fileEntries();
    const selected = selectedPath();
    if (files.length === 0) {
      if (selected) setSelectedPath(null);
      return;
    }
    if (!selected || !files.some((entry) => entry.path === selected)) {
      setSelectedPath(files[0].path);
    }
  });

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy();
      return;
    }

    if (key.name === "r") {
      setChanges(loadChanges(setError));
      return;
    }

    if (key.name === "j") {
      diffScroll?.scrollBy(1);
      return;
    }

    if (key.name === "k") {
      diffScroll?.scrollBy(-1);
      return;
    }

    if (key.name !== "h" && key.name !== "l" && key.name !== "left" && key.name !== "right") return;

    const files = fileEntries();
    if (files.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      files.findIndex((entry) => entry.path === selectedPath())
    );
    const isUp = key.name === "h" || key.name === "left";
    const nextIndex = isUp
      ? Math.max(0, currentIndex - 1)
      : Math.min(files.length - 1, currentIndex + 1);

    setSelectedPath(files[nextIndex].path);
  });

  const [diffData] = createResource(selectedPath, async (path) => {
    if (!path) return null;
    const change = changeMap().get(path);
    if (!change) return null;
    return loadDiff(change);
  });

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.crust}>
      <box
        height={3}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        alignItems="center"
        backgroundColor={colors.mantle}
      >
        <box flexGrow={1} />
        <Show
          when={!error()}
          fallback={<text fg={colors.red}>{error()}</text>}
        >
          <Show
            when={selectedFileName()}
            fallback={<text fg={colors.subtext0}>No local changes.</text>}
          >
            {(value) => (
              <box flexDirection="row" alignItems="center" gap={1}>
                <Show when={hasPrevFile()}>
                  <text fg={colors.subtext0}>←</text>
                </Show>
                <Show when={selectedChange()}>
                  {(change) => (
                    <text fg={statusColor(change().status)}>
                      {statusLabel(change().status)}
                    </text>
                  )}
                </Show>
                <text fg={colors.text}>{value()}</text>
                <Show when={diffData()}>
                  {(data) => (
                    <box flexDirection="row" gap={1}>
                      <text fg={colors.green}>+{data().added}</text>
                      <text fg={colors.red}>-{data().deleted}</text>
                      <text fg={colors.blue}>~{selectedChange()?.hunks ?? 0}</text>
                    </box>
                  )}
                </Show>
                <Show when={hasNextFile()}>
                  <text fg={colors.subtext0}>→</text>
                </Show>
              </box>
            )}
          </Show>
        </Show>
        <box flexGrow={1} />
      </box>

      <box flexGrow={1} height="100%" padding={1} flexDirection="column" backgroundColor={colors.base}>
        <box flexGrow={1} height="100%">
          <scrollbox
            ref={(el) => {
              diffScroll = el;
            }}
            height="100%"
            focused
          >
            <Show when={selectedPath()} fallback={<text fg="#888888">No local changes.</text>}>
              <Show when={diffData()} fallback={<text fg="#888888">Loading diff…</text>}>
                {(data) => (
                  <Show
                    when={data().diff.trim().length > 0}
                    fallback={<text fg="#888888">No diff for this file.</text>}
                  >
                    <diff
                      diff={data().diff}
                      view="unified"
                      filetype={data().language}
                      showLineNumbers
                    />
                  </Show>
                )}
              </Show>
            </Show>
          </scrollbox>
        </box>
      </box>

      <box
        height={3}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        alignItems="center"
        backgroundColor={colors.mantle}
      >
        <text fg={colors.subtext0}>q/esc quit  r refresh  h/l/←/→ file  j/k scroll</text>
      </box>
    </box>
  );
}

render(() => <App />);
