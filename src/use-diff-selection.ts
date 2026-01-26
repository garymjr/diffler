import type { DiffRenderable, ScrollBoxRenderable, TextBufferRenderable } from "@opentui/core";
import { convertGlobalToLocalSelection } from "@opentui/core";
import { useSelectionHandler } from "@opentui/solid";
import type { Accessor } from "solid-js";
import {
  buildLineStarts,
  extractLineRanges,
  formatLineRanges,
  getLineRangeFromSelection,
  isRenderableDescendant,
  type DiffLine,
  type SelectionInfo,
} from "./comments";

type DiffSelectionOptions = {
  isBlocked: Accessor<boolean>;
  selectedPath: Accessor<string | null>;
  diffLines: Accessor<DiffLine[]>;
  diffRenderable: Accessor<DiffRenderable | undefined>;
  diffScroll?: Accessor<ScrollBoxRenderable | undefined>;
  setSelectionInfo: (value: SelectionInfo | null) => void;
  onCursorMove?: (line: number) => void;
};

export function useDiffSelection(options: DiffSelectionOptions) {
  useSelectionHandler((selection) => {
    if (options.isBlocked()) return;
    const filePath = options.selectedPath();
    if (!filePath) return;
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

    const clampedStart = Math.max(0, lineRange.startLine);
    const clampedEnd = Math.min(lines.length - 1, lineRange.endLine);
    const textView = (target as any).textBufferView;
    if (textView?.setLocalSelection) {
      const maxLine = Math.max(0, lineStarts.length - 1);
      const minLine = Math.max(0, Math.min(maxLine, Math.min(clampedStart, clampedEnd)));
      const maxLineClamped = Math.max(0, Math.min(maxLine, Math.max(clampedStart, clampedEnd)));
      const width = Math.max(1, target.width);
      textView.setLocalSelection(
        0,
        minLine,
        Math.max(0, width - 1),
        maxLineClamped,
        (target as any).selectionBg,
        (target as any).selectionFg
      );
      (target as any).requestRender?.();
    }
    options.onCursorMove?.(clampedStart);

    const selectedText = selection.getSelectedText();
    if (!selectedText || !selectedText.trim()) return;
    const { oldRange, newRange } = extractLineRanges(lines, clampedStart, clampedEnd);
    const lineLabel = formatLineRanges(oldRange, newRange);

    options.setSelectionInfo({
      filePath,
      text: selectedText,
      startLine: clampedStart,
      endLine: clampedEnd,
      oldRange,
      newRange,
      lineLabel,
    });
  });
}
