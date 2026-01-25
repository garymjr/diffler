import { describe, expect, it } from "bun:test";
import { resolveLanguage } from "../src/language";

describe("language", () => {
  it("resolveLanguage maps known extensions", () => {
    expect(resolveLanguage("src/index.TS")).toBe("typescript");
    expect(resolveLanguage("README.md")).toBe("markdown");
    expect(resolveLanguage("data.json")).toBe("json");
  });
});
