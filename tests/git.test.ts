import { afterEach, describe, expect, it } from "bun:test";
import { loadChanges, loadDiff } from "../src/git";
import type { ChangeItem } from "../src/types";

const encoder = new TextEncoder();

type SpawnResult = {
  stdout: Uint8Array;
  stderr: Uint8Array;
  exitCode: number;
};

function makeResult(stdout: string, exitCode = 0, stderr = ""): SpawnResult {
  return {
    stdout: encoder.encode(stdout),
    stderr: encoder.encode(stderr),
    exitCode,
  };
}

describe("git", () => {
  const originalSpawn = Bun.spawnSync;

  afterEach(() => {
    Bun.spawnSync = originalSpawn;
  });

  it("loadChanges returns error outside git repo", () => {
    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      if (args.slice(1).join(" ") === "rev-parse --is-inside-work-tree") {
        return makeResult("false", 128);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    let error: string | null = null;
    const result = loadChanges((value) => {
      error = value;
    });

    expect(error).toBe("Not inside a git repository.");
    expect(result).toEqual([]);
  });

  it("loadChanges merges status entries with rename and untracked", () => {
    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      const joined = args.slice(1).join(" ");
      if (joined === "rev-parse --is-inside-work-tree") {
        return makeResult("true\n");
      }
      if (joined.startsWith("diff --patch")) {
        return makeResult("");
      }
      if (joined.startsWith("diff --cached")) {
        return makeResult("");
      }
      if (joined.startsWith("status --porcelain=v1")) {
        const status = [
          "R100 src/old.ts",
          "src/new.ts",
          "?? src/newfile.ts",
          "UU src/conflict.ts",
          "",
        ].join("\0");
        return makeResult(status);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    let error: string | null = null;
    const items = loadChanges((value) => {
      error = value;
    });

    expect(error).toBe(null);
    const byPath = new Map(items.map((item) => [item.path, item]));
    expect(byPath.get("src/new.ts")?.status).toBe("renamed");
    expect(byPath.get("src/new.ts")?.oldPath).toBe("src/old.ts");
    expect(byPath.get("src/newfile.ts")?.status).toBe("untracked");
    expect(byPath.get("src/conflict.ts")?.status).toBe("conflict");
  });

  it("loadChanges parses diffs, hunks, and applies untracked override", () => {
    const workingDiff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,2 @@",
      "-line1",
      "+line1a",
      " line2",
      "@@ -4,1 +4,2 @@",
      " line4",
      "+line5",
      "",
    ].join("\n");
    const stagedDiff = [
      "diff --git a/src/b.ts b/src/b.ts",
      "index 3333333..4444444 100644",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -1,1 +1,2 @@",
      " line1",
      "+line2",
      "",
    ].join("\n");

    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      const joined = args.slice(1).join(" ");
      if (joined === "rev-parse --is-inside-work-tree") {
        return makeResult("true\n");
      }
      if (joined.startsWith("diff --patch")) {
        return makeResult(workingDiff);
      }
      if (joined.startsWith("diff --cached --patch")) {
        return makeResult(stagedDiff);
      }
      if (joined.startsWith("status --porcelain=v1")) {
        const status = ["?? src/a.ts", ""].join("\0");
        return makeResult(status);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    let error: string | null = null;
    const items = loadChanges((value) => {
      error = value;
    });

    expect(error).toBe(null);
    const byPath = new Map(items.map((item) => [item.path, item]));
    expect(byPath.get("src/a.ts")?.status).toBe("untracked");
    expect(byPath.get("src/a.ts")?.hunks).toBe(2);
    expect(byPath.get("src/a.ts")?.added).toBe(2);
    expect(byPath.get("src/a.ts")?.deleted).toBe(1);
    expect(byPath.get("src/b.ts")?.status).toBe("modified");
    expect(byPath.get("src/b.ts")?.hunks).toBe(1);
    expect(byPath.get("src/b.ts")?.added).toBe(1);
    expect(byPath.get("src/b.ts")?.deleted).toBe(0);
  });

  it("loadChanges parses unstaged status entries with leading space", () => {
    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      const joined = args.slice(1).join(" ");
      if (joined === "rev-parse --is-inside-work-tree") {
        return makeResult("true\n");
      }
      if (joined.startsWith("diff --patch")) {
        return makeResult("");
      }
      if (joined.startsWith("diff --cached")) {
        return makeResult("");
      }
      if (joined.startsWith("status --porcelain=v1")) {
        const status = [" M src/only-unstaged.ts", ""].join("\0");
        return makeResult(status);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    let error: string | null = null;
    const items = loadChanges((value) => {
      error = value;
    });

    expect(error).toBe(null);
    expect(items).toHaveLength(1);
    expect(items[0].path).toBe("src/only-unstaged.ts");
    expect(items[0].status).toBe("modified");
  });

  it("loadDiff counts added/deleted lines for untracked files", () => {
    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      const joined = args.join(" ");
      if (joined.includes("--no-index")) {
        const diff = [
          "diff --git a/file.txt b/file.txt",
          "new file mode 100644",
          "index 0000000..1111111",
          "--- /dev/null",
          "+++ b/file.txt",
          "@@ -0,0 +1,2 @@",
          "+one",
          "+two",
          "",
        ].join("\n");
        return makeResult(diff);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    const change: ChangeItem = { path: "file.txt", status: "untracked" };
    const result = loadDiff(change);

    expect(result.added).toBe(2);
    expect(result.deleted).toBe(0);
    expect(result.message).toBeUndefined();
    expect(result.diff).toContain("+one");
  });

  it("loadDiff hides binary diff output", () => {
    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      const joined = args.join(" ");
      if (joined.includes("--no-index")) {
        const diff = "GIT binary patch\n";
        return makeResult(diff);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    const change: ChangeItem = { path: "image.png", status: "untracked" };
    const result = loadDiff(change);

    expect(result.message).toBe("Binary diff not shown.");
    expect(result.diff).toBe("");
    expect(result.added).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it("loadChanges supports stagedOnly filtering", () => {
    const stagedDiff = [
      "diff --git a/src/staged.ts b/src/staged.ts",
      "index 1111111..2222222 100644",
      "--- a/src/staged.ts",
      "+++ b/src/staged.ts",
      "@@ -1,1 +1,2 @@",
      " line1",
      "+line2",
      "",
    ].join("\n");

    Bun.spawnSync = ((cmd: string[] | { cmd: string[] }) => {
      const args = Array.isArray(cmd) ? cmd : cmd.cmd;
      const joined = args.slice(1).join(" ");
      if (joined === "rev-parse --is-inside-work-tree") {
        return makeResult("true\n");
      }
      if (joined.startsWith("diff --patch --no-color")) {
        return makeResult("");
      }
      if (joined.startsWith("diff --cached --patch --no-color")) {
        return makeResult(stagedDiff);
      }
      if (joined.startsWith("status --porcelain=v1")) {
        const status = [" M src/unstaged.ts", "M  src/staged.ts", ""].join("\0");
        return makeResult(status);
      }
      return makeResult("");
    }) as typeof Bun.spawnSync;

    let error: string | null = null;
    const items = loadChanges((value) => {
      error = value;
    }, { stagedOnly: true });

    expect(error).toBe(null);
    const byPath = new Map(items.map((item) => [item.path, item]));
    expect(byPath.has("src/unstaged.ts")).toBe(false);
    expect(byPath.get("src/staged.ts")?.hunks).toBe(1);
  });
});
