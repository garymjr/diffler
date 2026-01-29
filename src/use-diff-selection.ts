import type { DiffRenderable, ScrollBoxRenderable, TextBufferRenderable } from "@opentui/core";
import { convertGlobalToLocalSelection } from "@opentui/core";
import { useSelectionHandler } from "@opentui/solid";
import type { Accessor } from "solid-js";
import {
  buildLineStarts,
  getLineRangeFromSelection,
  isRenderableDescendant,
  type DiffLine,
} from "./comments";

type DiffSelectionOptions = {
  isBlocked: Accessor<boolean>;
  selectedPath: Accessor<string | null>;
  diffLines: Accessor<DiffLine[]>;
  diffRenderable: Accessor<DiffRenderable | undefined>;
  diffScroll?: Accessor<ScrollBoxRenderable | undefined>;
  onCursorMove?: (line: number) => void;
};

export function useDiffSelection(options: DiffSelectionOptions) {
  useSelectionHandler((selection) => {
    if (options.isBlocked()) return;
    if (!options.selectedPath()) return;
    const lines = options.diffLines();
    const diffRenderable = options.diffRenderable();
    if (!diffRenderable || lines.length === 0) return;

    const renderables = selection.selectedRenderables ?? [];
    const target = renderables.find(
      (renderable) =>
        isRenderableDescendant(renderable, diffRenderable) &&
        typeof (renderable as TextBufferRenderable).getSelection === "function"
    ) as TextBufferRenderable | undefined;

    if (!target) return;
    const range = target.getSelection?.();
    if (!range) {
      const localBounds = convertGlobalToLocalSelection(selection, target.x, target.y);
      if (!localBounds) return;
      const scrollTop = options.diffScroll?.()?.scrollTop ?? 0;
      const lineIndex = Math.max(0, localBounds.focusY + scrollTop);
      const lines = options.diffLines();
      if (lines.length === 0) return;
      options.onCursorMove?.(Math.min(lines.length - 1, lineIndex));
      return;
    }
    const plainText = target.plainText ?? "";
    if (!plainText) return;

    const lineStarts = buildLineStarts(plainText);
    const lineRange = getLineRangeFromSelection(
      lineStarts,
      plainText.length,
      range.start,
      range.end
    );
    if (!lineRange) return;

    const clampedStart = Math.max(0, Math.min(lines.length - 1, lineRange.startLine));
    options.onCursorMove?.(clampedStart);
  });
}
