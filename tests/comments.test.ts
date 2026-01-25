import { describe, expect, it } from "bun:test";
import {
  buildDiffLines,
  buildLineStarts,
  extractLineRanges,
  formatCommentEntries,
  formatCommentEntry,
  formatLineRanges,
  getLineRangeFromSelection,
} from "../src/comments";

describe("comments", () => {
  it("buildDiffLines parses unified diff lines with line numbers", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "index 1234567..89abcde 100644",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,2 +1,3 @@",
      " line1",
      "-line2",
      "+line2b",
      "+line3",
      "",
    ].join("\n");

    const lines = buildDiffLines(diff);
    expect(lines.length).toBe(4);
    expect({ ...lines[0], content: lines[0]?.content.trimEnd() }).toEqual({
      content: "line1",
      oldLine: 1,
      newLine: 1,
      type: "context",
    });
    expect({ ...lines[1], content: lines[1]?.content.trimEnd() }).toEqual({
      content: "line2",
      oldLine: 2,
      type: "deletion",
    });
    expect({ ...lines[2], content: lines[2]?.content.trimEnd() }).toEqual({
      content: "line2b",
      newLine: 2,
      type: "addition",
    });
    expect({ ...lines[3], content: lines[3]?.content.trimEnd() }).toEqual({
      content: "line3",
      newLine: 3,
      type: "addition",
    });
  });

  it("buildLineStarts and getLineRangeFromSelection handle reversed ranges", () => {
    const text = "a\nbee\nsee";
    const starts = buildLineStarts(text);
    const range = getLineRangeFromSelection(starts, text.length, 6, 2);
    expect(range).toEqual({ startLine: 1, endLine: 1 });
  });

  it("extractLineRanges and formatLineRanges produce labels", () => {
    const lines = [
      { content: "a", oldLine: 1, newLine: 1, type: "context" as const },
      { content: "b", oldLine: 2, type: "deletion" as const },
      { content: "c", newLine: 2, type: "addition" as const },
      { content: "d", newLine: 3, type: "addition" as const },
    ];
    const ranges = extractLineRanges(lines, 1, 3);
    expect(ranges.oldRange).toEqual([2, 2]);
    expect(ranges.newRange).toEqual([2, 3]);
    expect(formatLineRanges(ranges.oldRange, ranges.newRange)).toBe("old line 2, new lines 2-3");
  });

  it("formatCommentEntry and formatCommentEntries produce consistent blocks", () => {
    const entry = {
      id: "c1",
      filePath: "src/foo.ts",
      selectionText: "const a = 1;",
      lineLabel: "line 3",
      comment: "Looks good.",
      createdAt: 0,
    };

    const single = formatCommentEntry(entry);
    expect(single).toContain("File: src/foo.ts");
    expect(single).toContain("Lines: line 3");
    expect(single).toContain("```\nconst a = 1;\n```");
    expect(single).toContain("<comment>\nLooks good.\n</comment>");

    const combined = formatCommentEntries([entry, { ...entry, id: "c2" }]);
    expect(combined.split("---").length).toBe(2);
  });
});
