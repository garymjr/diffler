import type { DiffRenderable, ScrollBoxRenderable } from "@opentui/core";
import { render, useRenderer } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, onMount, Show } from "solid-js";
import path from "node:path";
import { ChangesPanel } from "./changes-panel";
import { CommentPanel } from "./comment-panel";
import { HelpPanel } from "./help-panel";
import { loadChanges, loadDiff } from "./git";
import { ThemePanel } from "./theme-panel";
import { catppuccinThemes, themeOrder, type Theme, type ThemeName } from "./theme";
import type { ChangeItem } from "./types";
import { copyToClipboard } from "./clipboard";
import { buildDiffLines, formatCommentEntries, type CommentEntry, type SelectionInfo } from "./comments";
import { statusColor, statusLabel } from "./status";
import { useAppKeyboard } from "./use-app-keyboard";
import { useDiffSelection } from "./use-diff-selection";

function App() {
  const renderer = useRenderer();
  const [error, setError] = createSignal<string | null>(null);
  const [changes, setChanges] = createSignal<ChangeItem[]>([]);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = createSignal(false);
  const [panelQuery, setPanelQuery] = createSignal("");
  const [panelIndex, setPanelIndex] = createSignal(0);
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
  const [ignoreNextCommentInput, setIgnoreNextCommentInput] = createSignal(false);
  const theme = createMemo(() => catppuccinThemes[themeName()]);
  const colors = createMemo(() => theme().colors);
  const themeEntries = createMemo<Theme[]>(() => themeOrder.map((name) => catppuccinThemes[name]));
  let diffScroll: ScrollBoxRenderable | undefined;
  let panelScroll: ScrollBoxRenderable | undefined;
  let diffRenderable: DiffRenderable | undefined;
  let lastPanelIndex = 0;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    setChanges(loadChanges(setError));
  });

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
  const hasPrevFile = createMemo(() => hasMultipleFiles() && selectedIndex() > 0);
  const hasNextFile = createMemo(() => {
    const index = selectedIndex();
    return hasMultipleFiles() && index >= 0 && index < fileEntries().length - 1;
  });
  const panelSelected = createMemo(() => {
    const entries = filteredEntries();
    const index = panelIndex();
    if (index < 0 || index >= entries.length) return null;
    return entries[index];
  });
  const openPanel = () => {
    setPanelQuery("");
    setPanelIndex(0);
    setIsPanelOpen(true);
    setIsThemePanelOpen(false);
    setIsHelpPanelOpen(false);
  };
  const closePanel = () => {
    setIsPanelOpen(false);
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
    setStatus("Saved comment.");
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
      setStatus("Copied file comments.");
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
    if (!isPanelOpen()) return;
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
    if (!isPanelOpen()) return;
    const index = panelIndex();
    if (!panelScroll || index < 0) return;
    const delta = index - lastPanelIndex;
    if (delta !== 0) {
      panelScroll.scrollBy(delta);
      lastPanelIndex = index;
    }
  });

  createEffect(() => {
    if (!isPanelOpen()) return;
    panelQuery();
    if (!panelScroll) return;
    panelScroll.scrollTo({ x: 0, y: 0 });
    lastPanelIndex = 0;
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

  const [diffData] = createResource(selectedPath, async (pathValue) => {
    if (!pathValue) return null;
    const change = changeMap().get(pathValue);
    if (!change) return null;
    return loadDiff(change);
  });

  const diffLines = createMemo(() => buildDiffLines(diffData()?.diff ?? ""));
  const fileCommentCount = createMemo(() => {
    const filePath = selectedPath();
    if (!filePath) return 0;
    return comments().filter((entry) => entry.filePath === filePath).length;
  });

  const refreshChanges = () => {
    setChanges(loadChanges(setError));
  };

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
    diffScroll: () => diffScroll,
    fileEntries,
    selectedPath,
  });

  useDiffSelection({
    isBlocked: () =>
      isPanelOpen() || isThemePanelOpen() || isHelpPanelOpen() || isCommentPanelOpen(),
    selectedPath,
    diffLines,
    diffRenderable: () => diffRenderable,
    setSelectionInfo,
  });

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors().crust}>
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
        <box flexGrow={1} />
        <Show
          when={!error()}
          fallback={<text fg={colors().red}>{error()}</text>}
        >
          <Show
            when={selectedFileName()}
            fallback={<text fg={colors().subtext0}>No local changes.</text>}
          >
            {(value) => (
              <box flexDirection="row" alignItems="center" gap={1}>
                <Show when={hasPrevFile()}>
                  <text fg={colors().subtext0}>←</text>
                </Show>
                <Show when={selectedChange()}>
                  {(change) => (
                    <text fg={statusColor(change().status, colors())}>
                      {statusLabel(change().status)}
                    </text>
                  )}
                </Show>
                <text fg={colors().text}>{value()}</text>
                <Show when={diffData()}>
                  {(data) => (
                    <box flexDirection="row" gap={1}>
                      <text fg={colors().green}>+{data().added}</text>
                      <text fg={colors().red}>-{data().deleted}</text>
                      <text fg={colors().blue}>~{selectedChange()?.hunks ?? 0}</text>
                    </box>
                  )}
                </Show>
                <Show when={hasNextFile()}>
                  <text fg={colors().subtext0}>→</text>
                </Show>
              </box>
            )}
          </Show>
        </Show>
        <box flexGrow={1} />
      </box>

      <box flexGrow={1} height="100%" padding={1} flexDirection="column" backgroundColor={colors().base}>
        <box flexGrow={1} height="100%">
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
              fallback={<text fg={colors().subtext0}>No local changes.</text>}
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
                        fallback={<text fg={colors().subtext0}>No diff for this file.</text>}
                      >
                        <diff
                          ref={(el) => {
                            diffRenderable = el;
                          }}
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
        <box flexGrow={1} flexDirection="row" gap={2}>
          <Show when={statusMessage()}>
            {(message) => <text fg={colors().subtext0}>{message()}</text>}
          </Show>
          <text fg={colors().subtext0}>comments: {fileCommentCount()}</text>
        </box>
        <text fg={colors().subtext0}>? help</text>
      </box>

      <CommentPanel
        isOpen={isCommentPanelOpen()}
        isFocused={isCommentFocused()}
        colors={colors()}
        selection={commentSelection()}
        comment={commentDraft()}
        onCommentChange={handleCommentChange}
      />
      <ChangesPanel
        isOpen={isPanelOpen()}
        query={panelQuery()}
        entries={filteredEntries()}
        selectedIndex={panelIndex()}
        colors={colors()}
        statusLabel={statusLabel}
        statusColor={(status) => statusColor(status, colors())}
        onQueryChange={setPanelQuery}
        onScrollRef={(el) => {
          panelScroll = el;
        }}
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
