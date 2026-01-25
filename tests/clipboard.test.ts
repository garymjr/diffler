import { afterEach, describe, expect, it } from "bun:test";
import { copyToClipboard } from "../src/clipboard";

const encoder = new TextEncoder();

describe("clipboard", () => {
  const originalSpawn = Bun.spawnSync;

  afterEach(() => {
    Bun.spawnSync = originalSpawn;
  });

  it("copyToClipboard uses platform command", () => {
    const calls: string[] = [];

    Bun.spawnSync = ((input: { cmd: string[] } | string[]) => {
      const args = Array.isArray(input) ? input : input.cmd;
      calls.push(args[0]);

      if (process.platform === "linux") {
        if (args[0] === "wl-copy") {
          return { stdout: encoder.encode(""), stderr: encoder.encode("fail"), exitCode: 1 };
        }
        return { stdout: encoder.encode(""), stderr: encoder.encode(""), exitCode: 0 };
      }

      return { stdout: encoder.encode(""), stderr: encoder.encode(""), exitCode: 0 };
    }) as typeof Bun.spawnSync;

    const result = copyToClipboard("hello");
    expect(result.ok).toBe(true);

    if (process.platform === "darwin") {
      expect(calls[0]).toBe("pbcopy");
    } else if (process.platform === "win32") {
      expect(calls[0]).toBe("clip");
    } else if (process.platform === "linux") {
      expect(calls.includes("wl-copy") || calls.includes("xclip")).toBe(true);
    }
  });
});
