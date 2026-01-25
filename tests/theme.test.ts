import { describe, expect, it } from "bun:test";
import { catppuccinThemes, getNextThemeName, themeOrder } from "../src/theme";

describe("theme", () => {
  it("getNextThemeName wraps around", () => {
    expect(getNextThemeName("mocha")).toBe("latte");
    expect(getNextThemeName("latte", -1)).toBe("mocha");
  });

  it("themeOrder matches catppuccinThemes", () => {
    for (const name of themeOrder) {
      expect(catppuccinThemes[name].name).toBe(name);
    }
  });
});
