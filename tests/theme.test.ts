import { describe, expect, it } from "bun:test";
import { getNextThemeId, themeById, themeOrder } from "../src/theme";

describe("theme", () => {
  it("getNextThemeId wraps around", () => {
    expect(getNextThemeId("mocha")).toBe("rose-pine");
    expect(getNextThemeId("latte", -1)).toBe("rose-pine-dawn");
  });

  it("themeOrder matches themeById", () => {
    for (const id of themeOrder) {
      expect(themeById[id].id).toBe(id);
    }
  });
});
