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
  scrollCommentHunk: (delta: number) => void;
  isThemePanelOpen: Accessor<boolean>;
  closeThemePanel: () => void;
  themeSelected: Accessor<{ id: string; name: string } | null>;
  setThemeId: (id: string) => void;
  moveThemeSelection: (delta: number) => void;
  isThemeSearchActive: Accessor<boolean>;
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
  moveDiffHunk: (delta: number) => void;
  clearDiffSelection: () => void;
  moveFileSelection: (delta: number) => void;
  fileEntries: Accessor<ChangeItem[]>;
  selectedPath: Accessor<string | null>;
};

export function useAppKeyboard(options: AppKeyboardOptions) {
  useKeyboard((key) => {
    if (options.isCommentPanelOpen()) {
      if (key.name === "escape") {
        options.closeCommentPanel();
        return;
      }
      if (key.ctrl && key.name === "u") {
        key.preventDefault();
        key.stopPropagation();
        options.scrollCommentHunk(-1);
        return;
      }
      if (key.ctrl && key.name === "d") {
        key.preventDefault();
        key.stopPropagation();
        options.scrollCommentHunk(1);
        return;
      }
      return;
    }

    if (options.isThemePanelOpen()) {
      if (options.isThemeSearchActive()) {
        if (key.name === "escape") {
          options.closeThemePanel();
          return;
        }
        if (key.name === "enter" || key.name === "return") {
          const selected = options.themeSelected();
          if (selected) {
            options.setThemeId(selected.id);
          }
          options.closeThemePanel();
          return;
        }
        if (key.ctrl && key.name === "n") {
          options.moveThemeSelection(1);
          return;
        }
        if (key.ctrl && key.name === "p") {
          options.moveThemeSelection(-1);
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
      if (key.name === "escape") {
        options.closeThemePanel();
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        const selected = options.themeSelected();
        if (selected) {
          options.setThemeId(selected.id);
        }
        options.closeThemePanel();
        return;
      }
      return;
    }

    if (options.isPanelOpen()) {
      if (options.isPanelSearchActive()) {
        if (key.name === "p") {
          options.closePanel();
          return;
        }
        if (key.name === "escape") {
          options.closePanel();
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
        if (key.ctrl && key.name === "n") {
          options.movePanelSelection(1);
          return;
        }
        if (key.ctrl && key.name === "p") {
          options.movePanelSelection(-1);
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
      if (key.name === "p") {
        key.preventDefault();
        key.stopPropagation();
        options.closePanel();
        return;
      }
      if (key.name === "escape") {
        options.closePanel();
        return;
      }
      if (key.ctrl && key.name === "n") {
        options.movePanelSelection(1);
        return;
      }
      if (key.ctrl && key.name === "p") {
        options.movePanelSelection(-1);
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
      key.preventDefault();
      key.stopPropagation();
      options.openPanel();
      return;
    }

    if (key.name === "t") {
      key.preventDefault();
      key.stopPropagation();
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

    if (key.name === "j") {
      key.preventDefault();
      key.stopPropagation();
      options.moveDiffHunk(1);
      return;
    }

    if (key.name === "k") {
      key.preventDefault();
      key.stopPropagation();
      options.moveDiffHunk(-1);
      return;
    }

    if (key.name === "down" || key.sequence === "\u001b[B") {
      options.moveDiffHunk(1);
      return;
    }

    if (key.name === "up" || key.sequence === "\u001b[A") {
      options.moveDiffHunk(-1);
      return;
    }

    if (key.name === "h") {
      options.moveFileSelection(-1);
      return;
    }

    if (key.name === "l") {
      options.moveFileSelection(1);
      return;
    }

    if (key.name === "left" || key.sequence === "\u001b[D") {
      options.moveFileSelection(-1);
      return;
    }

    if (key.name === "right" || key.sequence === "\u001b[C") {
      options.moveFileSelection(1);
      return;
    }
  });
}
