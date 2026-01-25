import { describe, expect, it } from "bun:test";
import { statusColor, statusLabel } from "../src/status";

const colors = {
  base: "#000",
  mantle: "#111",
  crust: "#222",
  text: "#eee",
  subtext0: "#ccc",
  red: "#f00",
  green: "#0f0",
  yellow: "#ff0",
  blue: "#00f",
};

describe("status", () => {
  it("statusLabel maps change statuses", () => {
    expect(statusLabel("added")).toBe("A");
    expect(statusLabel("copied")).toBe("C");
    expect(statusLabel("deleted")).toBe("D");
    expect(statusLabel("conflict")).toBe("U");
    expect(statusLabel("untracked")).toBe("??");
    expect(statusLabel("modified")).toBe("M");
  });

  it("statusColor maps to theme colors", () => {
    expect(statusColor("added", colors)).toBe(colors.green);
    expect(statusColor("deleted", colors)).toBe(colors.red);
    expect(statusColor("untracked", colors)).toBe(colors.yellow);
    expect(statusColor("modified", colors)).toBe(colors.blue);
  });
});
