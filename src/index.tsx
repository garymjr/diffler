import type { ScrollBoxRenderable } from "@opentui/core";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, onMount, Show } from "solid-js";
import path from "node:path";
import { ChangesPanel } from "./changes-panel";
import { HelpPanel } from "./help-panel";
import { loadChanges, loadDiff } from "./git";
import { ThemePanel } from "./theme-panel";
import { catppuccinThemes, themeOrder, type Theme, type ThemeColors, type ThemeName } from "./theme";
import type { ChangeItem, ChangeStatus } from "./types";

function statusLabel(status: ChangeStatus | undefined) {
  switch (status) {
    case "added":
      return "A";
    case "copied":
      return "C";
    case "deleted":
      return "D";
    case "conflict":
      return "U";
    case "untracked":
      return "??";
    default:
      return "M";
  }
}

function statusColor(status: ChangeStatus | undefined, colors: ThemeColors) {
  switch (status) {
    case "added":
      return colors.green;
    case "copied":
      return colors.green;
    case "deleted":
      return colors.red;
    case "conflict":
      return colors.red;
    case "untracked":
      return colors.yellow;
    default:
      return colors.blue;
  }
}

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
  const theme = createMemo(() => catppuccinThemes[themeName()]);
  const colors = createMemo(() => theme().colors);
  const themeEntries = createMemo<Theme[]>(() => themeOrder.map((name) => catppuccinThemes[name]));
  let diffScroll: ScrollBoxRenderable | undefined;
  let panelScroll: ScrollBoxRenderable | undefined;
  let lastPanelIndex = 0;

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
    if (isThemePanelOpen()) {
      if (key.name === "escape" || key.name === "t") {
        closeThemePanel();
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        const entries = themeEntries();
        const selected = entries[themeIndex()];
        if (selected) {
          setThemeName(selected.name);
        }
        closeThemePanel();
        return;
      }
      if (key.name === "k") {
        moveThemeSelection(-1);
        return;
      }
      if (key.name === "j") {
        moveThemeSelection(1);
        return;
      }
      if (key.name === "up" || key.sequence === "\u001b[A") {
        moveThemeSelection(-1);
        return;
      }
      if (key.name === "down" || key.sequence === "\u001b[B") {
        moveThemeSelection(1);
        return;
      }
      return;
    }

    if (isPanelOpen()) {
      if (key.name === "escape") {
        closePanel();
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        const selected = panelSelected();
        if (selected) {
          setSelectedPath(selected.path);
        }
        closePanel();
        return;
      }
      if (key.ctrl && key.name === "p") {
        movePanelSelection(-1);
        return;
      }
      if (key.ctrl && key.name === "n") {
        movePanelSelection(1);
        return;
      }
      if (key.name === "k") {
        movePanelSelection(-1);
        return;
      }
      if (key.name === "j") {
        movePanelSelection(1);
        return;
      }
      if (key.name === "up" || key.sequence === "\u001b[A") {
        movePanelSelection(-1);
        return;
      }
      if (key.name === "down" || key.sequence === "\u001b[B") {
        movePanelSelection(1);
        return;
      }
      if (key.name === "backspace") {
        setPanelQuery((value) => value.slice(0, -1));
        return;
      }
      if (key.name === "space") {
        setPanelQuery((value) => `${value} `);
        return;
      }
      if (!key.ctrl && !key.meta && !key.option && key.name.length === 1) {
        const nextChar = key.shift ? key.name.toUpperCase() : key.name;
        setPanelQuery((value) => `${value}${nextChar}`);
        return;
      }
      return;
    }

    const isHelpKey = key.name === "?" || (key.name === "/" && key.shift);
    if (isHelpPanelOpen()) {
      if (key.name === "escape" || isHelpKey) {
        setIsHelpPanelOpen(false);
      }
      return;
    }
    if (isHelpKey) {
      setIsHelpPanelOpen(true);
      return;
    }

    if (key.name === "p") {
      openPanel();
      return;
    }

    if (key.name === "t") {
      openThemePanel();
      return;
    }

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

  const [diffData] = createResource(selectedPath, async (pathValue) => {
    if (!pathValue) return null;
    const change = changeMap().get(pathValue);
    if (!change) return null;
    return loadDiff(change);
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
            focused={!isPanelOpen()}
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
                    when={data().diff.trim().length > 0}
                    fallback={<text fg={colors().subtext0}>No diff for this file.</text>}
                  >
                    <diff
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
        <box flexGrow={1} />
        <text fg={colors().subtext0}>? help</text>
      </box>

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
