import { SyntaxStyle } from "@opentui/core";

export type ThemeName = "latte" | "frappe" | "macchiato" | "mocha";

export type CatppuccinPalette = {
  text: string;
  subtext1: string;
  subtext0: string;
  overlay2: string;
  overlay1: string;
  overlay0: string;
  surface2: string;
  surface1: string;
  surface0: string;
  base: string;
  mantle: string;
  crust: string;
  lavender: string;
  blue: string;
  sapphire: string;
  sky: string;
  teal: string;
  green: string;
  yellow: string;
  peach: string;
  maroon: string;
  red: string;
  mauve: string;
  pink: string;
  flamingo: string;
  rosewater: string;
};

export type ThemeColors = Pick<
  CatppuccinPalette,
  "base" | "mantle" | "crust" | "text" | "subtext0" | "red" | "green" | "yellow" | "blue"
>;

export type Theme = {
  name: ThemeName;
  palette: CatppuccinPalette;
  colors: ThemeColors;
  diff: {
    addedBg: string;
    removedBg: string;
    contextBg: string;
    addedSignColor: string;
    removedSignColor: string;
    addedLineNumberBg: string;
    removedLineNumberBg: string;
  };
  syntaxStyle: SyntaxStyle;
};

const buildSyntaxStyle = (palette: CatppuccinPalette) =>
  SyntaxStyle.fromTheme([
    { scope: ["default"], style: { foreground: palette.text } },
    { scope: ["comment", "punctuation.comment"], style: { foreground: palette.overlay0, italic: true } },
    { scope: ["string"], style: { foreground: palette.green } },
    { scope: ["string.special", "character"], style: { foreground: palette.teal } },
    { scope: ["number", "constant.numeric", "boolean"], style: { foreground: palette.peach } },
    { scope: ["keyword", "operator"], style: { foreground: palette.mauve, bold: true } },
    { scope: ["type", "type.builtin"], style: { foreground: palette.yellow } },
    { scope: ["function", "function.call", "method"], style: { foreground: palette.blue } },
    { scope: ["variable", "property", "field"], style: { foreground: palette.text } },
    { scope: ["parameter"], style: { foreground: palette.rosewater } },
    { scope: ["constant", "constant.builtin"], style: { foreground: palette.peach } },
    { scope: ["attribute"], style: { foreground: palette.red } },
    { scope: ["tag"], style: { foreground: palette.maroon } },
    { scope: ["punctuation"], style: { foreground: palette.subtext0 } },
  ]);

const mixHex = (base: string, overlay: string, ratio: number) => {
  const normalize = (value: string) => value.replace("#", "");
  const baseValue = normalize(base);
  const overlayValue = normalize(overlay);
  const br = parseInt(baseValue.slice(0, 2), 16);
  const bg = parseInt(baseValue.slice(2, 4), 16);
  const bb = parseInt(baseValue.slice(4, 6), 16);
  const or = parseInt(overlayValue.slice(0, 2), 16);
  const og = parseInt(overlayValue.slice(2, 4), 16);
  const ob = parseInt(overlayValue.slice(4, 6), 16);
  if ([br, bg, bb, or, og, ob].some((value) => Number.isNaN(value))) return overlay;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  const r = Math.round(br + (or - br) * ratio);
  const g = Math.round(bg + (og - bg) * ratio);
  const b = Math.round(bb + (ob - bb) * ratio);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const buildTheme = (name: ThemeName, palette: CatppuccinPalette): Theme => ({
  name,
  palette,
  colors: {
    base: palette.base,
    mantle: palette.mantle,
    crust: palette.crust,
    text: palette.text,
    subtext0: palette.subtext0,
    red: palette.red,
    green: palette.green,
    yellow: palette.yellow,
    blue: palette.blue,
  },
  diff: {
    addedBg: mixHex(palette.base, palette.green, 0.22),
    removedBg: mixHex(palette.base, palette.red, 0.22),
    contextBg: "transparent",
    addedSignColor: palette.green,
    removedSignColor: palette.red,
    addedLineNumberBg: mixHex(palette.base, palette.green, 0.32),
    removedLineNumberBg: mixHex(palette.base, palette.red, 0.32),
  },
  syntaxStyle: buildSyntaxStyle(palette),
});

export const themeOrder: ThemeName[] = ["latte", "frappe", "macchiato", "mocha"];

const latte = buildTheme("latte", {
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  surface2: "#acb0be",
  surface1: "#bcc0cc",
  surface0: "#ccd0da",
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
  lavender: "#7287fd",
  blue: "#1e66f5",
  sapphire: "#209fb5",
  sky: "#04a5e5",
  teal: "#179299",
  green: "#40a02b",
  yellow: "#df8e1d",
  peach: "#fe640b",
  maroon: "#e64553",
  red: "#d20f39",
  mauve: "#8839ef",
  pink: "#ea76cb",
  flamingo: "#dd7878",
  rosewater: "#dc8a78",
});

const frappe = buildTheme("frappe", {
  text: "#c6d0f5",
  subtext1: "#b5bfe2",
  subtext0: "#a5adce",
  overlay2: "#949cbb",
  overlay1: "#838ba7",
  overlay0: "#737994",
  surface2: "#626880",
  surface1: "#51576d",
  surface0: "#414559",
  base: "#303446",
  mantle: "#292c3c",
  crust: "#232634",
  lavender: "#babbf1",
  blue: "#8caaee",
  sapphire: "#85c1dc",
  sky: "#99d1db",
  teal: "#81c8be",
  green: "#a6d189",
  yellow: "#e5c890",
  peach: "#ef9f76",
  maroon: "#ea999c",
  red: "#e78284",
  mauve: "#ca9ee6",
  pink: "#f4b8e4",
  flamingo: "#eebebe",
  rosewater: "#f2d5cf",
});

const macchiato = buildTheme("macchiato", {
  text: "#cad3f5",
  subtext1: "#b8c0e0",
  subtext0: "#a5adcb",
  overlay2: "#939ab7",
  overlay1: "#8087a2",
  overlay0: "#6e738d",
  surface2: "#5b6078",
  surface1: "#494d64",
  surface0: "#363a4f",
  base: "#24273a",
  mantle: "#1e2030",
  crust: "#181926",
  lavender: "#b7bdf8",
  blue: "#8aadf4",
  sapphire: "#7dc4e4",
  sky: "#91d7e3",
  teal: "#8bd5ca",
  green: "#a6da95",
  yellow: "#eed49f",
  peach: "#f5a97f",
  maroon: "#ee99a0",
  red: "#ed8796",
  mauve: "#c6a0f6",
  pink: "#f5bde6",
  flamingo: "#f0c6c6",
  rosewater: "#f4dbd6",
});

const mocha = buildTheme("mocha", {
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  lavender: "#b4befe",
  blue: "#89b4fa",
  sapphire: "#74c7ec",
  sky: "#89dceb",
  teal: "#94e2d5",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  peach: "#fab387",
  maroon: "#eba0ac",
  red: "#f38ba8",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  flamingo: "#f2cdcd",
  rosewater: "#f5e0dc",
});

export const catppuccinThemes: Record<ThemeName, Theme> = {
  latte,
  frappe,
  macchiato,
  mocha,
};

export const getNextThemeName = (current: ThemeName, direction: 1 | -1 = 1): ThemeName => {
  const index = themeOrder.indexOf(current);
  const nextIndex = (index + direction + themeOrder.length) % themeOrder.length;
  return themeOrder[nextIndex] ?? "mocha";
};
