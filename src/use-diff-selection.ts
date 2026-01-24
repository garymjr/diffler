import type { DiffRenderable, TextBufferRenderable } from "@opentui/core";
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
  setSelectionInfo: (value: SelectionInfo | null) => void;
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
    if (!range) return;
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

    const selectedText = selection.getSelectedText();
    if (!selectedText || !selectedText.trim()) return;

    const clampedStart = Math.max(0, lineRange.startLine);
    const clampedEnd = Math.min(lines.length - 1, lineRange.endLine);
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
