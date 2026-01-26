import type { CliRenderer } from "@opentui/core";
import { useKeyboard } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ChangeItem } from "./types";

const isHelpKey = (name: string, shift: boolean) => name === "?" || (name === "/" && shift);

type AppKeyboardOptions = {
  renderer: CliRenderer;
  isCommentPanelOpen: Accessor<boolean>;
  closeCommentPanel: () => void;
  saveComment: () => void;
  isThemePanelOpen: Accessor<boolean>;
  closeThemePanel: () => void;
  themeEntries: Accessor<{ name: string }[]>;
  themeIndex: Accessor<number>;
  setThemeName: (name: string) => void;
  moveThemeSelection: (delta: number) => void;
  isPanelOpen: Accessor<boolean>;
  closePanel: () => void;
  isPanelSearchActive: Accessor<boolean>;
  setIsPanelSearchActive: (value: boolean) => void;
  panelSelected: Accessor<ChangeItem | null>;
  setSelectedPath: (path: string) => void;
  movePanelSelection: (delta: number) => void;
  setPanelQuery: (value: string | ((value: string) => string)) => void;
  isHelpPanelOpen: Accessor<boolean>;
  setIsHelpPanelOpen: (value: boolean) => void;
  openPanel: () => void;
  openThemePanel: () => void;
  openCommentPanel: () => void;
  copyAllComments: () => void;
  refreshChanges: () => void;
  moveDiffCursor: (delta: number) => void;
  toggleDiffMultiSelect: () => void;
  exitDiffMultiSelect: () => void;
  clearDiffSelection: () => void;
  fileEntries: Accessor<ChangeItem[]>;
  selectedPath: Accessor<string | null>;
};

export function useAppKeyboard(options: AppKeyboardOptions) {
  useKeyboard((key) => {
    if (options.isCommentPanelOpen()) {
      if (key.name === "escape") {
        options.closeCommentPanel();
      }
      return;
    }

    if (options.isThemePanelOpen()) {
      if (key.name === "escape" || key.name === "t") {
        options.closeThemePanel();
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        const entries = options.themeEntries();
        const selected = entries[options.themeIndex()];
        if (selected) {
          options.setThemeName(selected.name);
        }
        options.closeThemePanel();
        return;
      }
      if (key.name === "k") {
        options.moveThemeSelection(-1);
        return;
      }
      if (key.name === "j") {
        options.moveThemeSelection(1);
        return;
      }
      if (key.name === "up" || key.sequence === "\u001b[A") {
        options.moveThemeSelection(-1);
        return;
      }
      if (key.name === "down" || key.sequence === "\u001b[B") {
        options.moveThemeSelection(1);
        return;
      }
      return;
    }

    if (options.isPanelOpen()) {
      if (options.isPanelSearchActive()) {
        if (key.name === "tab") {
          options.setIsPanelSearchActive(false);
          options.closePanel();
          return;
        }
        if (key.name === "escape") {
          options.setPanelQuery("");
          options.setIsPanelSearchActive(false);
          return;
        }
        if (key.name === "enter" || key.name === "return") {
          options.setIsPanelSearchActive(false);
          return;
        }
        return;
      }
      if (key.name === "tab") {
        options.closePanel();
        return;
      }
      if (key.name === "escape") {
        options.closePanel();
        return;
      }
      if (key.name === "/") {
        key.preventDefault();
        key.stopPropagation();
        options.setIsPanelSearchActive(true);
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        const selected = options.panelSelected();
        if (selected) {
          options.setSelectedPath(selected.path);
        }
        options.closePanel();
        return;
      }
      if (key.ctrl && key.name === "p") {
        options.movePanelSelection(-1);
        return;
      }
      if (key.ctrl && key.name === "n") {
        options.movePanelSelection(1);
        return;
      }
      if (key.name === "k") {
        options.movePanelSelection(-1);
        return;
      }
      if (key.name === "j") {
        options.movePanelSelection(1);
        return;
      }
      if (key.name === "up" || key.sequence === "\u001b[A") {
        options.movePanelSelection(-1);
        return;
      }
      if (key.name === "down" || key.sequence === "\u001b[B") {
        options.movePanelSelection(1);
        return;
      }
      return;
    }

    if (options.isHelpPanelOpen()) {
      if (key.name === "escape" || isHelpKey(key.name, key.shift)) {
        options.setIsHelpPanelOpen(false);
      }
      return;
    }

    if (isHelpKey(key.name, key.shift)) {
      options.setIsHelpPanelOpen(true);
      return;
    }

    if (key.name === "p") {
      options.openPanel();
      return;
    }

    if (key.name === "tab") {
      if (options.isPanelOpen()) {
        options.closePanel();
      } else {
        options.openPanel();
      }
      return;
    }

    if (key.name === "t") {
      options.openThemePanel();
      return;
    }

    if (key.name === "c") {
      options.openCommentPanel();
      return;
    }

    if (key.name === "y") {
      options.copyAllComments();
      return;
    }

    if (key.name === "escape") {
      key.preventDefault();
      key.stopPropagation();
      options.exitDiffMultiSelect();
      options.clearDiffSelection();
      return;
    }

    if (key.name === "q") {
      options.renderer.destroy();
      return;
    }

    if (key.name === "r") {
      options.refreshChanges();
      return;
    }

    if (key.name === "v") {
      key.preventDefault();
      key.stopPropagation();
      options.toggleDiffMultiSelect();
      return;
    }

    if (key.name === "j") {
      key.preventDefault();
      key.stopPropagation();
      options.moveDiffCursor(1);
      return;
    }

    if (key.name === "k") {
      key.preventDefault();
      key.stopPropagation();
      options.moveDiffCursor(-1);
      return;
    }

    if (key.name === "up" || key.sequence === "\u001b[A") {
      key.preventDefault();
      key.stopPropagation();
      options.moveDiffCursor(-1);
      return;
    }

    if (key.name === "down" || key.sequence === "\u001b[B") {
      key.preventDefault();
      key.stopPropagation();
      options.moveDiffCursor(1);
      return;
    }

    if (key.name !== "h" && key.name !== "l" && key.name !== "left" && key.name !== "right") return;

    const files = options.fileEntries();
    if (files.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      files.findIndex((entry) => entry.path === options.selectedPath())
    );
    const isUp = key.name === "h" || key.name === "left";
    const nextIndex = isUp
      ? Math.max(0, currentIndex - 1)
      : Math.min(files.length - 1, currentIndex + 1);

    options.setSelectedPath(files[nextIndex].path);
  });
}
