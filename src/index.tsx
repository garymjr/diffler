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
import { catppuccinThemes, themeOrder, type Theme, type ThemeName } from "./theme";
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
  const [themeName, setThemeName] = createSignal<ThemeName>("mocha");
  const [isThemePanelOpen, setIsThemePanelOpen] = createSignal(false);
  const [themeIndex, setThemeIndex] = createSignal(0);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = createSignal(false);
  const [isCommentPanelOpen, setIsCommentPanelOpen] = createSignal(false);
  const [isCommentFocused, setIsCommentFocused] = createSignal(false);
  const [commentDraft, setCommentDraft] = createSignal("");
  const [selectionInfo, setSelectionInfo] = createSignal<SelectionInfo | null>(null);
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
  const [isDiffMultiSelect, setIsDiffMultiSelect] = createSignal(false);
  const [diffSelectionAnchor, setDiffSelectionAnchor] = createSignal(0);
  const [diffSelectionFocus, setDiffSelectionFocus] = createSignal(0);
  const theme = createMemo(() => catppuccinThemes[themeName()]);
  const colors = createMemo(() => theme().colors);
  const themeEntries = createMemo<Theme[]>(() => themeOrder.map((name) => catppuccinThemes[name]));
  let diffScroll: ScrollBoxRenderable | undefined;
  let panelScroll: ScrollBoxRenderable | undefined;
  const [diffRenderable, setDiffRenderable] = createSignal<DiffRenderable | undefined>(undefined);
  let lastPanelIndex = 0;
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
  const selectedFileName = createMemo(() => {
    const current = selectedPath();
    return current ? path.basename(current) : null;
  });
  const selectedChange = createMemo(() => {
    const current = selectedPath();
    return current ? changeMap().get(current) ?? null : null;
  });
  const hasMultipleFiles = createMemo(() => fileEntries().length > 1);
  const panelSelected = createMemo(() => {
    const entries = filteredEntries();
    const index = panelIndex();
    if (index < 0 || index >= entries.length) return null;
    return entries[index];
  });
  const openPanel = () => {
    setPanelQuery("");
    const index = selectedIndex();
    setPanelIndex(index >= 0 ? index : 0);
    setIsPanelOpen(true);
    setIsPanelSearchActive(false);
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
    setThemeIndex(Math.max(0, themeOrder.indexOf(themeName())));
    setIsThemePanelOpen(true);
    setIsHelpPanelOpen(false);
  };
  const closeThemePanel = () => {
    setIsThemePanelOpen(false);
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
  const openCommentPanel = () => {
    const selection = selectionInfo();
    if (!selection) {
      setStatus("No selection.");
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
      setStatus("No selection.");
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
    const entries = themeEntries();
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
    const entries = themeEntries();
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
    setSelectionInfo(null);
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
  const selectionHighlightRange = createMemo(() => {
    if (isDiffMultiSelect()) {
      const min = Math.min(diffSelectionAnchor(), diffSelectionFocus());
      const max = Math.max(diffSelectionAnchor(), diffSelectionFocus());
      return { startLine: min, endLine: max };
    }
    const selection = selectionInfo();
    if (selection) return { startLine: selection.startLine, endLine: selection.endLine };
    const cursor = diffCursorLine();
    if (isDiffCursorActive() && cursor >= 0) return { startLine: cursor, endLine: cursor };
    return null;
  });
  const cursorLineLabel = createMemo(() => {
    const total = diffLineCount();
    const line = diffCursorLine();
    if (total <= 0 || line < 0) return "line: -";
    return `line: ${line + 1}/${total}`;
  });
  const selectionLabel = createMemo(() => {
    const selection = selectionInfo();
    if (!selection || !selection.lineLabel) return "sel: -";
    return `sel: ${selection.lineLabel}`;
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
  const updateDiffCursorHighlight = (lineIndex: number) => {
    if (!isDiffCursorActive()) return;
    const codeRenderable = getDiffCodeRenderable();
    if (!codeRenderable) return;
    const view = (codeRenderable as any).textBufferView;
    if (view?.setLocalSelection) {
      const width = Math.max(1, codeRenderable.width);
      const clamped = Math.max(0, Math.min(getDiffLineCount() - 1, lineIndex));
      view.setLocalSelection(
        0,
        clamped,
        Math.max(0, width - 1),
        clamped,
        (codeRenderable as any).selectionBg,
        (codeRenderable as any).selectionFg
      );
      (codeRenderable as any).requestRender?.();
    }
  };
  const updateDiffMultiSelection = (startLine: number, endLine: number) => {
    const codeRenderable = getDiffCodeRenderable();
    if (!codeRenderable) return;
    const view = (codeRenderable as any).textBufferView;
    if (!view?.setLocalSelection) return;
    const lineInfo = codeRenderable.lineInfo;
    const lineStarts = lineInfo?.lineStarts ?? [];
    if (lineStarts.length === 0) return;
    const anchor = Math.max(0, Math.min(lineStarts.length - 1, startLine));
    const focus = Math.max(0, Math.min(lineStarts.length - 1, endLine));
    const minLine = Math.min(anchor, focus);
    const maxLine = Math.max(anchor, focus);
    const width = Math.max(1, codeRenderable.width);
    view.setLocalSelection(
      0,
      minLine,
      Math.max(0, width - 1),
      maxLine,
      (codeRenderable as any).selectionBg,
      (codeRenderable as any).selectionFg
    );
    const plainText = codeRenderable.plainText ?? "";
    const filePath = selectedPath();
    const lines = diffLines();
    if (plainText && filePath && lines.length > 0) {
      const maxSelectable = Math.min(lineStarts.length, lines.length) - 1;
      const safeMin = Math.max(0, Math.min(maxSelectable, minLine));
      const safeMax = Math.max(0, Math.min(maxSelectable, maxLine));
      const startOffset = lineStarts[safeMin] ?? 0;
      const nextOffset = lineStarts[safeMax + 1] ?? plainText.length;
      const endOffset = Math.max(startOffset, nextOffset - 1);
      const { oldRange, newRange } = extractLineRanges(lines, safeMin, safeMax);
      const lineLabel = formatLineRanges(oldRange, newRange);
      setSelectionInfo({
        filePath,
        text: plainText.slice(startOffset, endOffset + 1),
        startLine: safeMin,
        endLine: safeMax,
        oldRange,
        newRange,
        lineLabel,
      });
    }
    (codeRenderable as any).requestRender?.();
  };
  const applyDiffLineHighlight = () => {
    const renderable = diffRenderable() as any;
    const side = renderable?.leftSide ?? renderable?.rightSide;
    if (!side?.setLineColors) return;
    const lines = diffLines();
    if (lines.length === 0) return;
    const currentTheme = theme();
    const selectionRange = selectionHighlightRange();
    const selectionColor = currentTheme.palette.surface2;
    const lineColors = new Map<number, { gutter?: string; content?: string }>();
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.type === "addition") {
        lineColors.set(i, {
          gutter: currentTheme.diff.addedLineNumberBg,
          content: currentTheme.diff.addedBg,
        });
      } else if (line.type === "deletion") {
        lineColors.set(i, {
          gutter: currentTheme.diff.removedLineNumberBg,
          content: currentTheme.diff.removedBg,
        });
      } else {
        lineColors.set(i, {
          gutter: "transparent",
          content: currentTheme.diff.contextBg,
        });
      }
    }
    if (selectionRange) {
      const min = Math.max(0, Math.min(lines.length - 1, selectionRange.startLine));
      const max = Math.max(0, Math.min(lines.length - 1, selectionRange.endLine));
      for (let i = Math.min(min, max); i <= Math.max(min, max); i += 1) {
        lineColors.set(i, { gutter: selectionColor, content: selectionColor });
      }
    }
    side.setLineColors(lineColors);
    side.requestRender?.();
  };
  const clearDiffSelection = () => {
    setSelectionInfo(null);
    setIsDiffCursorActive(true);
    const codeRenderable = getDiffCodeRenderable();
    const view = (codeRenderable as any)?.textBufferView;
    if (view?.resetLocalSelection) {
      view.resetLocalSelection();
      (codeRenderable as any)?.requestRender?.();
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
    setIsDiffMultiSelect(false);
    setSelectionInfo(null);
    setIsDiffCursorActive(true);
    setDiffCursorLine(lineIndex);
    setDiffSelectionAnchor(lineIndex);
    setDiffSelectionFocus(lineIndex);
    queueMicrotask(() => {
      updateDiffCursorHighlight(lineIndex);
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
      if (isDiffMultiSelect()) {
        updateDiffMultiSelection(diffSelectionAnchor(), diffSelectionFocus());
      } else {
        updateDiffCursorHighlight(line);
      }
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
  const moveDiffCursor = (delta: number) => {
    const totalLines = getDiffLineCount();
    if (totalLines === 0) return;
    setIsDiffCursorActive(true);
    const current = diffCursorLine();
    const next = Math.max(0, Math.min(totalLines - 1, (current < 0 ? 0 : current) + delta));
    setDiffCursorLine(next);
    if (isDiffMultiSelect()) {
      setDiffSelectionFocus(next);
      queueMicrotask(() => {
        updateDiffMultiSelection(diffSelectionAnchor(), next);
        ensureDiffCursorVisible(next);
        renderer.requestRender();
      });
      return;
    }
    setSelectionInfo(null);
    queueMicrotask(() => {
      updateDiffCursorHighlight(next);
      ensureDiffCursorVisible(next);
      renderer.requestRender();
    });
  };
  const toggleDiffMultiSelect = () => {
    const totalLines = getDiffLineCount();
    if (totalLines === 0) return;
    const nextState = !isDiffMultiSelect();
    setIsDiffMultiSelect(nextState);
    setIsDiffCursorActive(true);
    if (nextState) {
      const start = Math.max(0, Math.min(totalLines - 1, diffCursorLine()));
      setDiffSelectionAnchor(start);
      setDiffSelectionFocus(start);
      queueMicrotask(() => {
        updateDiffMultiSelection(start, start);
        ensureDiffCursorVisible(start);
        renderer.requestRender();
      });
    } else {
      const focus = diffSelectionFocus();
      setDiffCursorLine(focus);
      queueMicrotask(() => {
        updateDiffCursorHighlight(focus);
        ensureDiffCursorVisible(focus);
        renderer.requestRender();
      });
    }
  };
  const exitDiffMultiSelect = () => {
    if (!isDiffMultiSelect()) return;
    setIsDiffMultiSelect(false);
    const focus = diffSelectionFocus();
    setDiffCursorLine(focus);
    queueMicrotask(() => {
      updateDiffCursorHighlight(focus);
      ensureDiffCursorVisible(focus);
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
      if (isDiffMultiSelect()) {
        updateDiffMultiSelection(diffSelectionAnchor(), diffSelectionFocus());
      } else {
        updateDiffCursorHighlight(diffCursorLine());
      }
      ensureDiffCursorVisible(diffCursorLine());
      renderer.requestRender();
    };
    diffCursorInitTimer = setTimeout(tryInit, 0);
  };
  createEffect(() => {
    selectedPath();
    diffData();
    setIsDiffMultiSelect(false);
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
      if (isDiffMultiSelect()) {
        updateDiffMultiSelection(diffSelectionAnchor(), diffSelectionFocus());
      } else {
        updateDiffCursorHighlight(line);
      }
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
    selectionHighlightRange();
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
    themeEntries,
    themeIndex,
    setThemeName,
    moveThemeSelection,
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
    moveDiffCursor,
    toggleDiffMultiSelect,
    exitDiffMultiSelect,
    clearDiffSelection,
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
    setSelectionInfo,
    onCursorMove: (line) => {
      setIsDiffMultiSelect(false);
      setIsDiffCursorActive(true);
      setDiffCursorLine(line);
      setDiffSelectionAnchor(line);
      setDiffSelectionFocus(line);
      queueMicrotask(() => {
        updateDiffCursorHighlight(line);
        ensureDiffCursorVisible(line);
        renderer.requestRender();
      });
    },
  });

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors().crust}>
      <box
        height={6}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        backgroundColor={colors().mantle}
      >
        <box flexDirection="row" alignItems="center" height={3}>
          <box flexDirection="row" alignItems="center" gap={2}>
            <ascii_font text="DIFFLER" font="tiny" />
            <text fg={colors().text}>
              <strong>{repoName() ?? "no repo"}</strong>
            </text>
          </box>
          <box flexGrow={1} />
        </box>
        <box flexDirection="row" alignItems="center" height={1} width="100%">
          <text fg={colors().subtext0}>
            branch: {branchName() ?? "n/a"} · staged: {stagedOnly ? "on" : "off"} · watch: {watchEnabled ? "on" : "off"}
          </text>
          <box flexGrow={1} />
          <Show
            when={!error()}
            fallback={<text fg={colors().red}>{error()}</text>}
          >
            <Show
              when={selectedFileName()}
              fallback={
                <text fg={colors().subtext0}>Working tree clean · make a change to view a diff.</text>
              }
            >
              {(value) => (
                <box flexDirection="row" alignItems="center" gap={1}>
                  <Show when={selectedChange()}>
                    {(change) => (
                      <text fg={statusColor(change().status, colors())}>
                        {statusLabel(change().status)}
                      </text>
                    )}
                  </Show>
                  <text fg={colors().text}>{value()}</text>
                </box>
              )}
            </Show>
          </Show>
          <box flexGrow={1} />
          <Show when={!error() && selectedFileName()}>
            <text fg={colors().subtext0}>comments: {fileCommentCount()}</text>
          </Show>
        </box>
      </box>

      <box flexGrow={1} height="100%" padding={1} flexDirection="row" gap={1} backgroundColor={colors().base}>
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
        <box
          flexGrow={1}
          height="100%"
          border
          borderStyle="single"
          borderColor={
            !isPanelOpen() && !isThemePanelOpen() && !isHelpPanelOpen() && !isCommentPanelOpen()
              ? colors().blue
              : theme().palette.surface2
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
                fallback={<text fg={colors().subtext0}>Loading diff…</text>}
              >
                {(data) => (
                  <Show
                    when={data().message}
                    fallback={(
                      <Show
                        when={data().diff.trim().length > 0}
                        fallback={
                          <text fg={colors().subtext0}>No diff for this file. Try another file.</text>
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
                          addedBg={theme().diff.addedBg}
                          removedBg={theme().diff.removedBg}
                          contextBg={theme().diff.contextBg}
                          addedSignColor={theme().diff.addedSignColor}
                          removedSignColor={theme().diff.removedSignColor}
                          addedLineNumberBg={theme().diff.addedLineNumberBg}
                          removedLineNumberBg={theme().diff.removedLineNumberBg}
                          selectionBg={theme().palette.surface2}
                          selectionFg={theme().palette.text}
                          showLineNumbers
                        />
                      </Show>
                    )}
                  >
                    <text fg={colors().subtext0}>{data().message}</text>
                  </Show>
                )}
              </Show>
            </Show>
          </scrollbox>
        </box>
      </box>

      <Show when={isHelpPanelOpen()}>
        <HelpPanel colors={colors()} themeName={themeName()} />
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
            borderColor={colors().surface2}
            backgroundColor={colors().mantle}
            zIndex={5}
          >
            <text fg={colors().text}>{message()}</text>
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
        backgroundColor={colors().mantle}
      >
        <box flexGrow={1} flexDirection="row" gap={2} alignItems="center">
          <Show when={statusMessage()}>
            {(message) => <text fg={colors().subtext0}>{message()}</text>}
          </Show>
          <Show
            when={selectedChange()}
            fallback={<text fg={colors().subtext0}>status: n/a</text>}
          >
            {(change) => (
              <text fg={statusColor(change().status, colors())}>
                status: {statusLabel(change().status)}
              </text>
            )}
          </Show>
          <text fg={colors().subtext0}>{cursorLineLabel()}</text>
          <text fg={colors().subtext0}>{selectionLabel()}</text>
          <Show when={isDiffMultiSelect()}>
            <text fg={colors().yellow}>multi-select</text>
          </Show>
        </box>
        <box flexDirection="row" gap={2} alignItems="center">
          <text fg={colors().subtext0}>
            <strong>tab</strong> files
          </text>
          <text fg={colors().subtext0}>
            <strong>t</strong> theme
          </text>
          <text fg={colors().subtext0}>
            <strong>c</strong> comment
          </text>
          <text fg={colors().subtext0}>
            <strong>y</strong> copy
          </text>
          <text fg={colors().subtext0}>
            <strong>r</strong> refresh
          </text>
          <text fg={colors().subtext0}>
            <strong>q</strong> quit
          </text>
          <text fg={colors().subtext0}>
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
        themes={themeEntries()}
        selectedIndex={themeIndex()}
        colors={colors()}
      />
    </box>
  );
}

render(() => <App />);
