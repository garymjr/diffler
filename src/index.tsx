import type { DiffRenderable, MouseEvent, ScrollBoxRenderable, TextBufferRenderable } from "@opentui/core";
import { render, useRenderer } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, onCleanup, onMount, Show } from "solid-js";
import path from "node:path";
import { watch } from "node:fs";
import { ChangesPanel } from "./changes-panel";
import { CommentPanel } from "./comment-panel";
import { HelpPanel } from "./help-panel";
import { getBranchName, getRepoRoot, loadChanges, loadDiff } from "./git";
import { ThemePanel } from "./theme-panel";
import { defaultThemeId, themeById, themeOrder, type Theme, type ThemeId } from "./theme";
import { EmptyState } from "./empty-state";
import type { ChangeItem } from "./types";
import { copyToClipboard } from "./clipboard";
import {
  buildDiffLines,
  extractLineRanges,
  formatCommentEntries,
  formatLineRanges,
  type CommentEntry,
  type SelectionInfo,
} from "./comments";
import { statusColor, statusLabel } from "./status";
import { useAppKeyboard } from "./use-app-keyboard";
import { useDiffSelection } from "./use-diff-selection";

const stagedOnly = process.argv.includes("--staged");
const watchEnabled = process.argv.includes("--watch");

function App() {
  const renderer = useRenderer();
  const [error, setError] = createSignal<string | null>(null);
  const [changes, setChanges] = createSignal<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = createSignal(false);
  const [panelQuery, setPanelQuery] = createSignal("");
  const [panelIndex, setPanelIndex] = createSignal(0);
  const [isPanelSearchActive, setIsPanelSearchActive] = createSignal(false);
  const [themeId, setThemeId] = createSignal<ThemeId>(defaultThemeId);
  const [isThemePanelOpen, setIsThemePanelOpen] = createSignal(false);
  const [themeIndex, setThemeIndex] = createSignal(0);
  const [themeQuery, setThemeQuery] = createSignal("");
  const [isThemeSearchActive, setIsThemeSearchActive] = createSignal(false);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = createSignal(false);
  const [isCommentPanelOpen, setIsCommentPanelOpen] = createSignal(false);
  const [isCommentFocused, setIsCommentFocused] = createSignal(false);
  const [commentDraft, setCommentDraft] = createSignal("");
  const [commentSelection, setCommentSelection] = createSignal<SelectionInfo | null>(null);
  const [comments, setComments] = createSignal<CommentEntry[]>([]);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);
  const [ignoreNextCommentInput, setIgnoreNextCommentInput] = createSignal(false);
  const [refreshTick, setRefreshTick] = createSignal(0);
  const [repoName, setRepoName] = createSignal<string | null>(null);
  const [branchName, setBranchName] = createSignal<string | null>(null);
  const [diffCursorLine, setDiffCursorLine] = createSignal(0);
  const [isDiffCursorActive, setIsDiffCursorActive] = createSignal(true);
  const theme = createMemo(() => themeById[themeId()]);
  const colors = createMemo(() => theme().colors);
  const themeEntries = createMemo<Theme[]>(() => themeOrder.map((id) => themeById[id]));
  let diffScroll: ScrollBoxRenderable | undefined;
  let panelScroll: ScrollBoxRenderable | undefined;
  let themePanelScroll: ScrollBoxRenderable | undefined;
  const [diffRenderable, setDiffRenderable] = createSignal<DiffRenderable | undefined>(undefined);
  let lastPanelIndex = 0;
  let lastThemeIndex = 0;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let diffCursorInitTimer: ReturnType<typeof setTimeout> | undefined;
  let diffCursorInitAttempts = 0;

  const fileEntries = createMemo(() => changes());
  const filteredEntries = createMemo(() => {
    const query = panelQuery().trim().toLowerCase();
    if (!query) return fileEntries();
    return fileEntries().filter((entry) => entry.path.toLowerCase().includes(query));
  });
  const filteredThemes = createMemo(() => {
    const query = themeQuery().trim().toLowerCase();
    if (!query) return themeEntries();
    return themeEntries().filter((entry) => entry.name.toLowerCase().includes(query));
  });
  const changeMap = createMemo(() => {
    const map = new Map<string, ChangeItem>();
    for (const change of changes()) {
      map.set(change.path, change);
    }
    return map;
  });

  const selectedIndex = createMemo(() => {
    const pathValue = selectedPath();
    if (!pathValue) return -1;
    return fileEntries().findIndex((entry) => entry.path === pathValue);
  });
  const hasPrevFile = createMemo(() => selectedIndex() > 0);
  const hasNextFile = createMemo(() => {
    const index = selectedIndex();
    return index >= 0 && index < fileEntries().length - 1;
  });
  const selectedFileName = createMemo(() => {
    const current = selectedPath();
    return current ? path.basename(current) : null;
  });
  const selectedChange = createMemo(() => {
    const current = selectedPath();
    return current ? changeMap().get(current) ?? null : null;
  });
  const panelSelected = createMemo(() => {
    const entries = filteredEntries();
    const index = panelIndex();
    if (index < 0 || index >= entries.length) return null;
    return entries[index];
  });
  const themeSelected = createMemo(() => {
    const entries = filteredThemes();
    const index = themeIndex();
    if (index < 0 || index >= entries.length) return null;
    return entries[index];
  });
  const openPanel = () => {
    setPanelQuery("");
    const index = selectedIndex();
    setPanelIndex(index >= 0 ? index : 0);
    setIsPanelOpen(true);
    setIsPanelSearchActive(true);
    setIsThemePanelOpen(false);
    setIsHelpPanelOpen(false);
  };
  const closePanel = () => {
    setIsPanelOpen(false);
    setIsPanelSearchActive(false);
    setPanelQuery("");
    const index = selectedIndex();
    if (index >= 0) setPanelIndex(index);
  };
  const openThemePanel = () => {
    setIsPanelOpen(false);
    setThemeIndex(Math.max(0, themeOrder.indexOf(themeId())));
    setThemeQuery("");
    setIsThemePanelOpen(true);
    setIsThemeSearchActive(true);
    setIsHelpPanelOpen(false);
  };
  const closeThemePanel = () => {
    setIsThemePanelOpen(false);
    setIsThemeSearchActive(false);
    setThemeQuery("");
    setThemeIndex(Math.max(0, themeOrder.indexOf(themeId())));
  };

  const setStatus = (message: string) => {
    setStatusMessage(message);
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      setStatusMessage(null);
    }, 2200);
  };
  const setToast = (message: string) => {
    setToastMessage(message);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };
  const buildHunkSelection = (): SelectionInfo | null => {
    const filePath = selectedPath();
    if (!filePath) return null;
    const lines = diffLines();
    if (lines.length === 0) return null;
    const range = currentHunkRange();
    if (!range) return null;
    const start = Math.max(0, Math.min(lines.length - 1, range.start));
    const end = Math.max(start, Math.min(lines.length - 1, range.end));
    const text = lines
      .slice(start, end + 1)
      .map((line) => {
        const prefix = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";
        const content = (line.content ?? "").replace(/\r?\n/g, "");
        return `${prefix}${content}`;
      })
      .join("\n");
    const { oldRange, newRange } = extractLineRanges(lines, start, end);
    const lineLabel = formatLineRanges(oldRange, newRange);
    return {
      filePath,
      text,
      startLine: start,
      endLine: end,
      oldRange,
      newRange,
      lineLabel,
    };
  };
  const openCommentPanel = () => {
    const selection = buildHunkSelection();
    if (!selection) {
      setStatus("No hunk selected.");
      return;
    }
    setCommentSelection(selection);
    setCommentDraft("");
    setIgnoreNextCommentInput(true);
    setIsCommentPanelOpen(true);
    setIsCommentFocused(false);
    queueMicrotask(() => {
      setIsCommentFocused(true);
    });
    setIsPanelOpen(false);
    setIsThemePanelOpen(false);
    setIsHelpPanelOpen(false);
  };
  const closeCommentPanel = () => {
    setIsCommentPanelOpen(false);
    setIsCommentFocused(false);
    setIgnoreNextCommentInput(false);
  };
  const saveComment = () => {
    const selection = commentSelection();
    if (!selection) {
      setStatus("No hunk selected.");
      return;
    }
    const comment = commentDraft().trim();
    if (!comment) {
      setStatus("Comment empty.");
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry: CommentEntry = {
      id,
      filePath: selection.filePath,
      selectionText: selection.text.trimEnd(),
      lineLabel: selection.lineLabel,
      oldRange: selection.oldRange,
      newRange: selection.newRange,
      comment,
      createdAt: Date.now(),
    };
    setComments((prev) => [...prev, entry]);
    setCommentDraft("");
    setIgnoreNextCommentInput(false);
    setIsCommentPanelOpen(false);
    setIsCommentFocused(false);
    setToast("Saved comment.");
  };

  const handleCommentChange = (value: string) => {
    if (ignoreNextCommentInput()) {
      if (value === "") {
        setCommentDraft("");
        return;
      }
      setIgnoreNextCommentInput(false);
      if (value === "c") {
        setCommentDraft("");
        return;
      }
    }
    setCommentDraft(value);
  };

  const copyAllComments = () => {
    const filePath = selectedPath();
    if (!filePath) {
      setStatus("No file selected.");
      return;
    }
    const fileComments = comments().filter((entry) => entry.filePath === filePath);
    if (fileComments.length === 0) {
      setStatus("No comments for file.");
      return;
    }
    const result = copyToClipboard(formatCommentEntries(fileComments));
    if (result.ok) {
      setToast("Copied file comments.");
    } else {
      setStatus(`Copy failed: ${result.error ?? "unknown error"}`);
    }
  };

  const movePanelSelection = (delta: number) => {
    const entries = filteredEntries();
    if (entries.length === 0) {
      setPanelIndex(-1);
      return;
    }
    const nextIndex = Math.max(0, Math.min(entries.length - 1, panelIndex() + delta));
    setPanelIndex(nextIndex);
  };

  const moveThemeSelection = (delta: number) => {
    const entries = filteredThemes();
    if (entries.length === 0) {
      setThemeIndex(-1);
      return;
    }
    const nextIndex = Math.max(0, Math.min(entries.length - 1, themeIndex() + delta));
    setThemeIndex(nextIndex);
  };

  createEffect(() => {
    const entries = filteredEntries();
    if (entries.length === 0) {
      if (panelIndex() !== -1) setPanelIndex(-1);
      return;
    }
    if (panelIndex() < 0) {
      setPanelIndex(0);
      return;
    }
    if (panelIndex() >= entries.length) {
      setPanelIndex(entries.length - 1);
    }
  });

  createEffect(() => {
    if (!isThemePanelOpen()) return;
    const entries = filteredThemes();
    if (entries.length === 0) {
      if (themeIndex() !== -1) setThemeIndex(-1);
      return;
    }
    if (themeIndex() < 0) {
      setThemeIndex(0);
      return;
    }
    if (themeIndex() >= entries.length) {
      setThemeIndex(entries.length - 1);
    }
  });

  createEffect(() => {
    const index = panelIndex();
    if (!panelScroll || index < 0) return;
    const delta = index - lastPanelIndex;
    if (delta !== 0) {
      panelScroll.scrollBy(delta);
      lastPanelIndex = index;
    }
  });

  createEffect(() => {
    panelQuery();
    if (!panelScroll) return;
    panelScroll.scrollTo({ x: 0, y: 0 });
    lastPanelIndex = 0;
  });

  createEffect(() => {
    const index = themeIndex();
    if (!themePanelScroll || index < 0) return;
    const delta = index - lastThemeIndex;
    if (delta !== 0) {
      themePanelScroll.scrollBy(delta);
      lastThemeIndex = index;
    }
  });

  createEffect(() => {
    themeQuery();
    if (!themePanelScroll) return;
    themePanelScroll.scrollTo({ x: 0, y: 0 });
    lastThemeIndex = 0;
  });

  createEffect(() => {
    if (isPanelOpen()) return;
    const entries = filteredEntries();
    if (entries.length === 0) return;
    const current = selectedPath();
    if (!current) {
      if (panelIndex() !== 0) setPanelIndex(0);
      return;
    }
    const index = entries.findIndex((entry) => entry.path === current);
    if (index >= 0 && index !== panelIndex()) {
      setPanelIndex(index);
    }
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

  createEffect(() => {
    selectedPath();
    setCommentSelection(null);
    setIsCommentPanelOpen(false);
  });

  const [diffData] = createResource(
    () => {
      const pathValue = selectedPath();
      if (!pathValue) return null;
      return { pathValue, tick: refreshTick() };
    },
    async (value) => {
      if (!value) return null;
      const change = changeMap().get(value.pathValue);
      if (!change) return null;
      return loadDiff(change, { stagedOnly });
    }
  );

  const diffLines = createMemo(() => buildDiffLines(diffData()?.diff ?? ""));
  const diffLineCount = createMemo(() => diffLines().length);
  const hunkStartLines = createMemo(() => {
    const lines = diffLines();
    const indices: number[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i]?.isHunkStart) indices.push(i);
    }
    return indices;
  });
  const currentHunkStart = createMemo(() => {
    const starts = hunkStartLines();
    if (starts.length === 0) return -1;
    const line = diffCursorLine();
    if (line < 0) return starts[0] ?? -1;
    let current = starts[0] ?? -1;
    for (const start of starts) {
      if (start > line) break;
      current = start;
    }
    return current;
  });
  const getHunkStartForLine = (line: number) => {
    const starts = hunkStartLines();
    if (starts.length === 0) return -1;
    if (line < 0) return starts[0] ?? -1;
    let current = starts[0] ?? -1;
    for (const start of starts) {
      if (start > line) break;
      current = start;
    }
    return current;
  };
  const currentHunkRange = createMemo(() => {
    const starts = hunkStartLines();
    if (starts.length === 0) return null;
    const start = currentHunkStart();
    if (start < 0) return null;
    const startIndex = starts.indexOf(start);
    const nextStart = startIndex >= 0 ? starts[startIndex + 1] : undefined;
    const end = typeof nextStart === "number" ? nextStart - 1 : diffLines().length - 1;
    return { start, end };
  });
  const fileCommentCount = createMemo(() => {
    const filePath = selectedPath();
    if (!filePath) return 0;
    return comments().filter((entry) => entry.filePath === filePath).length;
  });
  const getDiffCodeRenderable = (): TextBufferRenderable | null => {
    const renderable = diffRenderable() as
      | (DiffRenderable & { leftCodeRenderable?: TextBufferRenderable; rightCodeRenderable?: TextBufferRenderable })
      | undefined;
    return renderable?.leftCodeRenderable ?? renderable?.rightCodeRenderable ?? null;
  };
  const getDiffLineCount = () => {
    const codeRenderable = getDiffCodeRenderable();
    if (!codeRenderable) return 0;
    const lineInfo = codeRenderable.lineInfo;
    return lineInfo?.lineStarts?.length ?? 0;
  };
  const applyDiffLineHighlight = () => {
    const renderable = diffRenderable() as any;
    const side = renderable?.leftSide ?? renderable?.rightSide;
    if (!side?.setLineColors) return;
    const lines = diffLines();
    if (lines.length === 0) return;
    const currentTheme = theme();
    const lineColors = new Map<number, { gutter?: string; content?: string }>();
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.type === "addition") {
        lineColors.set(i, {
          gutter: currentTheme.diff.added.line,
          content: currentTheme.diff.added.bg,
        });
      } else if (line.type === "deletion") {
        lineColors.set(i, {
          gutter: currentTheme.diff.removed.line,
          content: currentTheme.diff.removed.bg,
        });
      } else {
        lineColors.set(i, {
          gutter: "transparent",
          content: currentTheme.diff.context.bg,
        });
      }
    }
    side.setLineColors(lineColors);
    const baseSigns = typeof side.getLineSigns === "function" ? side.getLineSigns() : new Map<number, any>();
    const nextSigns = new Map<number, any>();
    for (const [line, sign] of baseSigns) {
      nextSigns.set(line, { ...sign, before: undefined, beforeColor: undefined });
    }
    const range = currentHunkRange();
    if (range) {
      const end = Math.max(range.start, Math.min(lines.length - 1, range.end));
      for (let i = range.start; i <= end; i += 1) {
        const existing = nextSigns.get(i) ?? {};
        nextSigns.set(i, { ...existing, before: "▌", beforeColor: colors().accent.blue });
      }
    }
    if (typeof side.setLineSigns === "function") {
      side.setLineSigns(nextSigns);
    }
    side.requestRender?.();
  };
  const clearDiffSelection = () => {
    setIsDiffCursorActive(true);
  };
  const moveFileSelection = (delta: number) => {
    const entries = fileEntries();
    if (entries.length === 0) return;
    const currentIndex = selectedIndex();
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(entries.length - 1, baseIndex + delta));
    const next = entries[nextIndex];
    if (!next) return;
    if (next.path !== selectedPath()) {
      setSelectedPath(next.path);
    }
  };
  const handleDiffMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    if (isPanelOpen() || isThemePanelOpen() || isHelpPanelOpen() || isCommentPanelOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    const codeRenderable = getDiffCodeRenderable();
    if (!codeRenderable) return;
    const rawLine = event.y - codeRenderable.y;
    if (!Number.isFinite(rawLine)) return;
    const lineIndex = Math.max(0, Math.min(getDiffLineCount() - 1, Math.floor(rawLine)));
    setIsDiffCursorActive(true);
    setDiffCursorLine(lineIndex);
    queueMicrotask(() => {
      ensureDiffCursorVisible(lineIndex);
      renderer.requestRender();
    });
  };
  const handleDiffMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return;
    if (isPanelOpen() || isThemePanelOpen() || isHelpPanelOpen() || isCommentPanelOpen()) return;
    const line = diffCursorLine();
    if (line < 0) return;
    queueMicrotask(() => {
      ensureDiffCursorVisible(line);
      renderer.requestRender();
    });
  };
  const ensureDiffCursorVisible = (lineIndex: number) => {
    if (!diffScroll) return;
    const viewportHeight = (diffScroll as any).viewport?.height;
    const viewHeight = typeof viewportHeight === "number" ? viewportHeight : undefined;
    if (!viewHeight || viewHeight <= 0) {
      diffScroll.scrollTo({ x: 0, y: Math.max(0, lineIndex) });
      return;
    }
    const top = diffScroll.scrollTop;
    const bottom = top + Math.max(0, viewHeight - 1);
    if (lineIndex < top) {
      diffScroll.scrollTo({ x: 0, y: lineIndex });
    } else if (lineIndex > bottom) {
      diffScroll.scrollTo({ x: 0, y: Math.max(0, lineIndex - viewHeight + 1) });
    }
  };
  const ensureHunkVisible = (startLine: number) => {
    if (!diffScroll) return;
    const range = currentHunkRange();
    if (!range) {
      ensureDiffCursorVisible(startLine);
      return;
    }
    const viewportHeight = (diffScroll as any).viewport?.height;
    const viewHeight = typeof viewportHeight === "number" ? viewportHeight : undefined;
    if (!viewHeight || viewHeight <= 0) {
      diffScroll.scrollTo({ x: 0, y: Math.max(0, startLine) });
      return;
    }
    const top = diffScroll.scrollTop;
    const bottom = top + Math.max(0, viewHeight - 1);
    const endLine = Math.max(range.start, Math.min(range.end, diffLineCount() - 1));
    const hunkSize = Math.max(1, endLine - range.start + 1);
    if (hunkSize >= viewHeight) {
      diffScroll.scrollTo({ x: 0, y: range.start });
      return;
    }
    if (range.start < top) {
      diffScroll.scrollTo({ x: 0, y: range.start });
    } else if (endLine > bottom) {
      const nextTop = Math.max(0, endLine - viewHeight + 1);
      diffScroll.scrollTo({ x: 0, y: nextTop });
    }
  };

  const refreshChanges = () => {
    const repoRoot = getRepoRoot();
    if (!repoRoot) {
      setRepoName(null);
      setBranchName(null);
    } else {
      setRepoName(path.basename(repoRoot));
      setBranchName(getBranchName());
    }
    setChanges(loadChanges(setError, { stagedOnly }));
    setRefreshTick((value) => value + 1);
  };
  const moveDiffHunk = (delta: number) => {
    const hunks = hunkStartLines();
    if (hunks.length === 0) return;
    setIsDiffCursorActive(true);
    const scrollTop = diffScroll?.scrollTop ?? -1;
    const baseLine = Math.max(diffCursorLine(), scrollTop);
    const current = getHunkStartForLine(baseLine);
    let next: number | undefined;
    if (delta > 0) {
      if (current < 0) {
        next = hunks[0];
      } else {
        next = hunks.find((line) => line > current);
      }
    } else {
      if (current < 0) {
        next = hunks[hunks.length - 1];
      } else {
        for (let i = hunks.length - 1; i >= 0; i -= 1) {
          if (hunks[i] < current) {
            next = hunks[i];
            break;
          }
        }
      }
    }
    if (next === undefined) return;
    setDiffCursorLine(next);
    queueMicrotask(() => {
      ensureHunkVisible(next);
      applyDiffLineHighlight();
      renderer.requestRender();
    });
  };
  const scheduleDiffCursorInit = () => {
    if (diffCursorInitTimer) clearTimeout(diffCursorInitTimer);
    diffCursorInitAttempts = 0;
    const tryInit = () => {
      diffCursorInitAttempts += 1;
      if (!getDiffCodeRenderable()) {
        if (diffCursorInitAttempts < 12) {
          diffCursorInitTimer = setTimeout(tryInit, 16);
        }
        return;
      }
      const totalLines = getDiffLineCount();
      if (totalLines === 0) return;
      if (diffCursorLine() < 0) setDiffCursorLine(0);
      ensureDiffCursorVisible(diffCursorLine());
      renderer.requestRender();
    };
    diffCursorInitTimer = setTimeout(tryInit, 0);
  };
  createEffect(() => {
    selectedPath();
    diffData();
    const totalLines = getDiffLineCount();
    if (totalLines === 0) {
      setDiffCursorLine(-1);
      setIsDiffCursorActive(false);
    } else {
      setDiffCursorLine(0);
      setIsDiffCursorActive(true);
    }
    scheduleDiffCursorInit();
  });
  createEffect(() => {
    if (!isDiffCursorActive()) return;
    const line = diffCursorLine();
    if (line < 0) return;
    diffData();
    queueMicrotask(() => {
      ensureDiffCursorVisible(line);
      renderer.requestRender();
    });
  });
  createEffect(() => {
    diffRenderable();
    diffData();
    scheduleDiffCursorInit();
  });
  createEffect(() => {
    diffRenderable();
    diffLines();
    theme();
    currentHunkRange();
    queueMicrotask(() => {
      applyDiffLineHighlight();
    });
  });

  onMount(() => {
    refreshChanges();
    if (!watchEnabled) return;
    const repoRoot = getRepoRoot();
    if (!repoRoot) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const watcher = watch(
      repoRoot,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) return;
        if (filename === ".git" || filename.startsWith(".git/")) return;
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => refreshChanges(), 120);
      }
    );
    onCleanup(() => watcher.close());
  });

  useAppKeyboard({
    renderer,
    isCommentPanelOpen,
    closeCommentPanel,
    saveComment,
    isThemePanelOpen,
    closeThemePanel,
    themeSelected,
    setThemeId,
    moveThemeSelection,
    isThemeSearchActive,
    isPanelOpen,
    closePanel,
    isPanelSearchActive,
    setIsPanelSearchActive,
    panelSelected,
    setSelectedPath,
    movePanelSelection,
    setPanelQuery,
    isHelpPanelOpen,
    setIsHelpPanelOpen,
    openPanel,
    openThemePanel,
    openCommentPanel,
    copyAllComments,
    refreshChanges,
    moveDiffHunk,
    clearDiffSelection,
    moveFileSelection,
    fileEntries,
    selectedPath,
  });

  useDiffSelection({
    isBlocked: () =>
      isPanelOpen() || isThemePanelOpen() || isHelpPanelOpen() || isCommentPanelOpen(),
    selectedPath,
    diffLines,
    diffRenderable,
    diffScroll: () => diffScroll,
    onCursorMove: (line) => {
      setIsDiffCursorActive(true);
      setDiffCursorLine(line);
      queueMicrotask(() => {
        ensureDiffCursorVisible(line);
        applyDiffLineHighlight();
        renderer.requestRender();
      });
    },
  });

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={colors().background.base}
    >
      <box
        height={3}
        width="100%"
        paddingLeft={2}
        paddingRight={2}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        backgroundColor={colors().panel.base}
      >
        <Show
          when={!error()}
          fallback={<text fg={colors().accent.red}>{error()}</text>}
        >
          <Show
            when={selectedFileName()}
            fallback={
              <text fg={colors().text.muted}>Working tree clean · make a change to view a diff.</text>
            }
          >
            {(value) => (
              <box flexDirection="row" alignItems="center" gap={1}>
                <Show when={hasPrevFile()}>
                  <text fg={colors().text.muted}>←</text>
                </Show>
                <Show when={selectedChange()}>
                  {(change) => (
                    <text fg={statusColor(change().status, colors())}>
                      {statusLabel(change().status)}
                    </text>
                  )}
                </Show>
                <text fg={colors().text.primary}>{value()}</text>
                <Show when={selectedChange()}>
                  {(change) => {
                    const added = change().added ?? 0;
                    const deleted = change().deleted ?? 0;
                    const hunks = change().hunks ?? 0;
                    return (
                      <box flexDirection="row" alignItems="center" gap={1}>
                        <text fg={colors().accent.green}>+{added}</text>
                        <text fg={colors().accent.red}>-{deleted}</text>
                        <text fg={colors().accent.blue}>~{hunks}</text>
                      </box>
                    );
                  }}
                </Show>
                <Show when={hasNextFile()}>
                  <text fg={colors().text.muted}>→</text>
                </Show>
              </box>
            )}
          </Show>
        </Show>
      </box>

      <box
        flexGrow={1}
        height="100%"
        padding={1}
        flexDirection="row"
        gap={1}
        backgroundColor={colors().background.base}
      >
        <box
          flexGrow={1}
          height="100%"
          border
          borderStyle="single"
          borderColor={
            !isPanelOpen() && !isThemePanelOpen() && !isHelpPanelOpen() && !isCommentPanelOpen()
              ? colors().accent.blue
              : colors().panel.border
          }
          title="Diff"
          titleAlignment="left"
          padding={1}
        >
          <scrollbox
            ref={(el) => {
              diffScroll = el;
            }}
            height="100%"
            focused={
              !isPanelOpen() && !isThemePanelOpen() && !isHelpPanelOpen() && !isCommentPanelOpen()
            }
          >
            <Show
              when={selectedPath()}
              fallback={
                <EmptyState
                  title="CLEAN"
                  subtitle="Working tree clean."
                  hint="Make a change to view a diff."
                  colors={colors()}
                />
              }
            >
              <Show
                when={diffData()}
                fallback={<text fg={colors().text.muted}>Loading diff…</text>}
              >
                {(data) => (
                  <Show
                    when={data().message}
                    fallback={(
                      <Show
                        when={data().diff.trim().length > 0}
                        fallback={
                          <text fg={colors().text.muted}>No diff for this file. Try another file.</text>
                        }
                      >
                        <diff
                          ref={(el) => {
                            setDiffRenderable(el);
                          }}
                          onMouseDown={handleDiffMouseDown}
                          onMouseUp={handleDiffMouseUp}
                          diff={data().diff}
                          view="unified"
                          filetype={data().language}
                          syntaxStyle={theme().syntaxStyle}
                          addedBg={theme().diff.added.bg}
                          removedBg={theme().diff.removed.bg}
                          contextBg={theme().diff.context.bg}
                          addedSignColor={theme().diff.added.sign}
                          removedSignColor={theme().diff.removed.sign}
                          addedLineNumberBg={theme().diff.added.line}
                          removedLineNumberBg={theme().diff.removed.line}
                          selectionBg={theme().colors.selection.bg}
                          selectionFg={theme().colors.selection.fg}
                          showLineNumbers
                        />
                      </Show>
                    )}
                  >
                    <text fg={colors().text.muted}>{data().message}</text>
                  </Show>
                )}
              </Show>
            </Show>
          </scrollbox>
        </box>
      </box>

      <ChangesPanel
        isOpen={isPanelOpen()}
        isSearchActive={isPanelSearchActive()}
        query={panelQuery()}
        entries={filteredEntries()}
        selectedIndex={panelIndex()}
        colors={colors()}
        statusLabel={statusLabel}
        statusColor={(status) => statusColor(status, colors())}
        onQueryChange={setPanelQuery}
        onScrollRef={(el) => {
          panelScroll = el;
          if (panelScroll) {
            const index = panelIndex();
            if (index >= 0) panelScroll.scrollTo({ x: 0, y: index });
            lastPanelIndex = index;
          }
        }}
      />
      <Show when={isHelpPanelOpen()}>
        <HelpPanel colors={colors()} themeName={theme().name} />
      </Show>
      <Show when={toastMessage()}>
        {(message) => (
          <box
            position="absolute"
            right={1}
            top={1}
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            border
            borderStyle="single"
            borderColor={colors().panel.border}
            backgroundColor={colors().panel.base}
            zIndex={5}
          >
            <text fg={colors().text.primary}>{message()}</text>
          </box>
        )}
      </Show>
      <box
        height={3}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        alignItems="center"
        backgroundColor={colors().panel.base}
      >
        <box flexGrow={1} flexDirection="row" gap={2} alignItems="center">
          <Show when={statusMessage()}>
            {(message) => <text fg={colors().text.muted}>{message()}</text>}
          </Show>
          <Show
            when={selectedChange()}
            fallback={<text fg={colors().text.muted}>status: n/a</text>}
          >
            {(change) => (
              <text fg={statusColor(change().status, colors())}>
                status: {statusLabel(change().status)}
              </text>
            )}
          </Show>
        </box>
        <box flexDirection="row" gap={2} alignItems="center">
          <text fg={colors().text.muted}>
            <strong>p</strong> files
          </text>
          <text fg={colors().text.muted}>
            <strong>t</strong> theme
          </text>
          <text fg={colors().text.muted}>
            <strong>c</strong> comment
          </text>
          <text fg={colors().text.muted}>
            <strong>y</strong> copy
          </text>
          <text fg={colors().text.muted}>
            <strong>r</strong> refresh
          </text>
          <text fg={colors().text.muted}>
            <strong>q</strong> quit
          </text>
          <text fg={colors().text.muted}>
            <strong>?</strong> help
          </text>
        </box>
      </box>

      <CommentPanel
        isOpen={isCommentPanelOpen()}
        isFocused={isCommentFocused()}
        colors={colors()}
        selection={commentSelection()}
        comment={commentDraft()}
        onCommentChange={handleCommentChange}
        onSubmit={saveComment}
      />
      <ThemePanel
        isOpen={isThemePanelOpen()}
        isSearchActive={isThemeSearchActive()}
        query={themeQuery()}
        themes={filteredThemes()}
        selectedIndex={themeIndex()}
        colors={colors()}
        onQueryChange={setThemeQuery}
        onScrollRef={(el) => {
          themePanelScroll = el;
        }}
      />
    </box>
  );
}

render(() => <App />);
