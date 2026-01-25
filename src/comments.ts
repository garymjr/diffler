import { parsePatchFiles } from "@pierre/diffs";

type DiffLineType = "context" | "addition" | "deletion";

type LineRange = [number, number];

export type DiffLine = {
  content: string;
  oldLine?: number;
  newLine?: number;
  type: DiffLineType;
};

export type SelectionInfo = {
  filePath: string;
  text: string;
  startLine: number;
  endLine: number;
  oldRange?: LineRange;
  newRange?: LineRange;
  lineLabel: string;
};

export type CommentEntry = {
  id: string;
  filePath: string;
  selectionText: string;
  lineLabel: string;
  oldRange?: LineRange;
  newRange?: LineRange;
  comment: string;
  createdAt: number;
};

export function buildDiffLines(diff: string): DiffLine[] {
  if (!diff.trim()) return [];
  let patches: ReturnType<typeof parsePatchFiles>;
  try {
    patches = parsePatchFiles(diff);
  } catch {
    return [];
  }
  if (patches.length === 0) return [];

  const lines: DiffLine[] = [];

  for (const patch of patches) {
    for (const file of patch.files ?? []) {
      if (!file?.hunks?.length) continue;
      for (const hunk of file.hunks) {
        let oldLine = hunk.deletionStart;
        let newLine = hunk.additionStart;

        for (const group of hunk.hunkContent ?? []) {
          if (group.type === "context") {
            for (const line of group.lines) {
              lines.push({ content: line, oldLine, newLine, type: "context" });
              oldLine += 1;
              newLine += 1;
            }
            continue;
          }

          for (const line of group.deletions) {
            lines.push({ content: line, oldLine, type: "deletion" });
            oldLine += 1;
          }
          for (const line of group.additions) {
            lines.push({ content: line, newLine, type: "addition" });
            newLine += 1;
          }
        }
      }
    }
  }

  return lines;
}

export function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

export function getLineRangeFromSelection(
  lineStarts: number[],
  textLength: number,
  start: number,
  end: number
): { startLine: number; endLine: number } | null {
  if (lineStarts.length === 0 || textLength === 0) return null;
  const min = Math.max(0, Math.min(start, end));
  const max = Math.min(textLength, Math.max(start, end));
  const endOffset = Math.max(min, max - 1);
  const startLine = lineIndexForOffset(lineStarts, textLength, min);
  const endLine = lineIndexForOffset(lineStarts, textLength, endOffset);
  return { startLine, endLine };
}

export function extractLineRanges(
  lines: DiffLine[],
  startLine: number,
  endLine: number
): { oldRange?: LineRange; newRange?: LineRange } {
  const slice = lines.slice(startLine, endLine + 1);
  const oldLines = slice
    .map((line) => line.oldLine)
    .filter((value): value is number => typeof value === "number");
  const newLines = slice
    .map((line) => line.newLine)
    .filter((value): value is number => typeof value === "number");

  return {
    oldRange: toRange(oldLines),
    newRange: toRange(newLines),
  };
}

export function formatLineRanges(oldRange?: LineRange, newRange?: LineRange): string {
  if (oldRange && newRange) {
    return `old ${formatRange(oldRange)}, new ${formatRange(newRange)}`;
  }
  if (newRange) return formatRange(newRange);
  if (oldRange) return `old ${formatRange(oldRange)}`;
  return "";
}

export function formatCommentEntry(entry: CommentEntry): string {
  const parts = [
    `File: ${entry.filePath}`,
    entry.lineLabel ? `Lines: ${entry.lineLabel}` : "Lines:",
    "",
    "```",
    entry.selectionText,
    "```",
    "",
    "<comment>",
    entry.comment,
    "</comment>",
  ];
  return parts.join("\n");
}

export function formatCommentEntries(entries: CommentEntry[]): string {
  return entries.map(formatCommentEntry).join("\n\n---\n\n");
}

export function isRenderableDescendant(renderable: any, ancestor: any): boolean {
  let current = renderable;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function formatRange(range: LineRange): string {
  const [start, end] = range;
  if (start === end) return `line ${start}`;
  return `lines ${start}-${end}`;
}

function toRange(values: number[]): LineRange | undefined {
  if (values.length === 0) return undefined;
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function lineIndexForOffset(
  lineStarts: number[],
  textLength: number,
  offset: number
): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineStarts[mid];
    const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : textLength + 1;
    if (offset < start) {
      high = mid - 1;
    } else if (offset >= next) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(lineStarts.length - 1, low));
}
