import { getFiletypeFromFileName, parsePatchFiles } from "@pierre/diffs";
import type { ScrollBoxRenderable } from "@opentui/core";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, For, Show, onMount } from "solid-js";
import path from "node:path";

type ChangeStatus = "modified" | "added" | "deleted" | "renamed" | "untracked";

type ChangeItem = {
  path: string;
  status: ChangeStatus;
  oldPath?: string;
  hunks?: number;
};

type TreeEntry = {
  kind: "dir" | "file";
  name: string;
  path: string;
  depth: number;
  status?: ChangeStatus;
  hunks?: number;
};

type DiffData = {
  diff: string;
  language?: string;
};

type FocusTarget = "sidebar" | "diff";

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

type TreeNode = {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file?: ChangeItem;
};

function buildTreeEntries(items: ChangeItem[]): TreeEntry[] {
  const root: TreeNode = {
    name: "",
    path: "",
    children: new Map(),
  };

  for (const item of items) {
    const parts = item.path.split("/");
    let current = root;
    let currentPath = "";

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = current.children.get(part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          children: new Map(),
        };
        current.children.set(part, child);
      }
      if (index === parts.length - 1) {
        child.file = item;
      }
      current = child;
    }
  }

  const entries: TreeEntry[] = [];

  const walk = (node: TreeNode, depth: number) => {
    const children = Array.from(node.children.values()).sort((a, b) => {
      const aIsFile = Boolean(a.file) && a.children.size === 0;
      const bIsFile = Boolean(b.file) && b.children.size === 0;
      if (aIsFile !== bIsFile) {
        return aIsFile ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const child of children) {
      const isFile = Boolean(child.file) && child.children.size === 0;
      entries.push({
        kind: isFile ? "file" : "dir",
        name: child.name,
        path: child.path,
        depth,
        status: child.file?.status,
        hunks: child.file?.hunks,
      });
      walk(child, depth + 1);
    }
  };

  walk(root, 0);
  return entries;
}

function statusBadge(status: ChangeStatus | undefined) {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "untracked":
      return "?";
    default:
      return "M";
  }
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

  return {
    diff: diffParts.join("\n"),
    language: resolveLanguage(change.path),
  };
}

function App() {
  const renderer = useRenderer();
  const [error, setError] = createSignal<string | null>(null);
  const [changes, setChanges] = createSignal<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [focus, setFocus] = createSignal<FocusTarget>("sidebar");
  let sidebarScroll: ScrollBoxRenderable | undefined;
  let diffScroll: ScrollBoxRenderable | undefined;

  onMount(() => {
    setChanges(loadChanges(setError));
  });

  const entries = createMemo(() => buildTreeEntries(changes()));
  const renderEntries = createMemo(() => {
    const selected = selectedPath();
    return entries().map((entry) => ({
      entry,
      isSelected: entry.kind === "file" && entry.path === selected,
    }));
  });
  const changeMap = createMemo(() => {
    const map = new Map<string, ChangeItem>();
    for (const change of changes()) {
      map.set(change.path, change);
    }
    return map;
  });

  const fileEntries = createMemo(() => entries().filter((entry) => entry.kind === "file"));

  createEffect(() => {
    if (!selectedPath() && fileEntries().length > 0) {
      setSelectedPath(fileEntries()[0].path);
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

    if (key.name === "1") {
      setFocus("sidebar");
      return;
    }

    if (key.name === "2") {
      setFocus("diff");
      return;
    }

    if (focus() === "diff") {
      if (key.name === "j") {
        diffScroll?.scrollBy(1);
      }
      if (key.name === "k") {
        diffScroll?.scrollBy(-1);
      }
      return;
    }

    if (key.name !== "up" && key.name !== "down" && key.name !== "j" && key.name !== "k") {
      return;
    }

    const files = fileEntries();
    if (files.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      files.findIndex((entry) => entry.path === selectedPath())
    );
    const isUp = key.name === "up" || key.name === "k";
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
    <box width="100%" height="100%" flexDirection="row">
      <box width={32} height="100%" border borderRight padding={1} flexDirection="column">
        <box height={1}>
          <text>Changes</text>
        </box>
        <scrollbox
          ref={(el) => {
            sidebarScroll = el;
          }}
          height="100%"
          focused={focus() === "sidebar"}
        >
          <Show
            when={!error()}
            fallback={<text fg="#ff6666">{error()}</text>}
          >
            <Show
              when={entries().length > 0}
              fallback={<text fg="#888888">No local changes.</text>}
            >
              <For each={renderEntries()}>
                {(item) => {
                  const { entry, isSelected } = item;
                  const indent = " ".repeat(entry.depth * 2);
                  const prefix = isSelected ? "▸ " : "  ";
                  const label = entry.kind === "dir"
                    ? `${indent}[${entry.name}]`
                    : `${indent}${statusBadge(entry.status)} ${entry.name}`;

                  return (
                    <box
                      width="100%"
                      height={1}
                      backgroundColor={isSelected ? "#2f323a" : "transparent"}
                      onMouseDown={() => {
                        if (entry.kind === "file") {
                          setSelectedPath(entry.path);
                        }
                        setFocus("sidebar");
                      }}
                    >
                      <text fg={entry.kind === "dir" ? "#888888" : isSelected ? "#ffffff" : "#d0d0d0"}>
                        {prefix}{label}
                        <Show when={entry.kind === "file" && entry.hunks !== undefined}>
                          <span fg="#666666"> ({entry.hunks})</span>
                        </Show>
                      </text>
                    </box>
                  );
                }}
              </For>
            </Show>
          </Show>
        </scrollbox>
      </box>

      <box
        flexGrow={1}
        height="100%"
        border
        padding={1}
        flexDirection="column"
        onMouseDown={() => setFocus("diff")}
      >
        <box height={1}>
          <text fg="#d0d0d0">
            <Show when={selectedPath()} fallback="Select a file to view diff.">
              {(value) => value()}
            </Show>
          </text>
        </box>
        <box flexGrow={1} height="100%">
          <scrollbox
            ref={(el) => {
              diffScroll = el;
            }}
            height="100%"
            focused={focus() === "diff"}
          >
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
          </scrollbox>
        </box>
      </box>
    </box>
  );
}

render(() => <App />);
