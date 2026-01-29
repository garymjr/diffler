import { SyntaxStyle } from "@opentui/core";

export type ThemeId = string;

export type ThemePalette = {
  background: {
    base: string;
    panel: {
      base: string;
      muted: string;
      alt: string;
      border: string;
    };
  };
  text: {
    primary: string;
    muted: string;
  };
  accent: {
    red: string;
    green: string;
    yellow: string;
    blue: string;
  };
};

export type ThemeColors = {
  background: {
    base: string;
  };
  panel: {
    base: string;
    muted: string;
    alt: string;
    border: string;
  };
  text: {
    primary: string;
    muted: string;
  };
  accent: {
    red: string;
    green: string;
    yellow: string;
    blue: string;
  };
  selection: {
    bg: string;
    fg: string;
  };
};

export type ThemeSyntaxColors = {
  text: string;
  comment: string;
  string: {
    base: string;
    special: string;
  };
  number: string;
  keyword: string;
  type: string;
  function: string;
  variable: string;
  parameter: string;
  constant: string;
  attribute: string;
  tag: string;
  punctuation: string;
};

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  palette: ThemePalette;
  syntax: ThemeSyntaxColors;
};

export type Theme = ThemeDefinition & {
  colors: ThemeColors;
  diff: {
    added: {
      bg: string;
      sign: string;
      line: string;
    };
    removed: {
      bg: string;
      sign: string;
      line: string;
    };
    context: {
      bg: string;
    };
  };
  syntaxStyle: SyntaxStyle;
};

const buildSyntaxStyle = (syntax: ThemeSyntaxColors) =>
  SyntaxStyle.fromTheme([
    { scope: ["default"], style: { foreground: syntax.text } },
    { scope: ["comment", "punctuation.comment"], style: { foreground: syntax.comment, italic: true } },
    { scope: ["string"], style: { foreground: syntax.string.base } },
    { scope: ["string.special", "character"], style: { foreground: syntax.string.special } },
    { scope: ["number", "constant.numeric", "boolean"], style: { foreground: syntax.number } },
    { scope: ["keyword", "operator"], style: { foreground: syntax.keyword, bold: true } },
    { scope: ["type", "type.builtin"], style: { foreground: syntax.type } },
    { scope: ["function", "function.call", "method"], style: { foreground: syntax.function } },
    { scope: ["variable", "property", "field"], style: { foreground: syntax.variable } },
    { scope: ["parameter"], style: { foreground: syntax.parameter } },
    { scope: ["constant", "constant.builtin"], style: { foreground: syntax.constant } },
    { scope: ["attribute"], style: { foreground: syntax.attribute } },
    { scope: ["tag"], style: { foreground: syntax.tag } },
    { scope: ["punctuation"], style: { foreground: syntax.punctuation } },
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

const buildTheme = (definition: ThemeDefinition): Theme => {
  const base = definition.palette.background.base;
  const accent = definition.palette.accent;
  const panel = definition.palette.background.panel;
  return {
    ...definition,
    colors: {
      background: {
        base,
      },
      panel: {
        base: panel.base,
        muted: panel.muted,
        alt: panel.alt,
        border: panel.border,
      },
      text: {
        primary: definition.palette.text.primary,
        muted: definition.palette.text.muted,
      },
      accent: {
        red: accent.red,
        green: accent.green,
        yellow: accent.yellow,
        blue: accent.blue,
      },
      selection: {
        bg: panel.border,
        fg: definition.palette.text.primary,
      },
    },
    diff: {
      added: {
        bg: mixHex(base, accent.green, 0.22),
        sign: accent.green,
        line: mixHex(base, accent.green, 0.32),
      },
      removed: {
        bg: mixHex(base, accent.red, 0.22),
        sign: accent.red,
        line: mixHex(base, accent.red, 0.32),
      },
      context: {
        bg: "transparent",
      },
    },
    syntaxStyle: buildSyntaxStyle(definition.syntax),
  };
};

export const themeOrder: ThemeId[] = [
  "latte",
  "frappe",
  "macchiato",
  "mocha",
  "rose-pine",
  "rose-pine-moon",
  "rose-pine-dawn",
];

const latte = buildTheme({
  id: "latte",
  name: "Catppuccin Latte",
  palette: {
    background: {
      base: "#eff1f5",
      panel: {
        base: "#e6e9ef",
        muted: "#ccd0da",
        alt: "#bcc0cc",
        border: "#acb0be",
      },
    },
    text: {
      primary: "#4c4f69",
      muted: "#6c6f85",
    },
    accent: {
      red: "#d20f39",
      green: "#40a02b",
      yellow: "#df8e1d",
      blue: "#1e66f5",
    },
  },
  syntax: {
    text: "#4c4f69",
    comment: "#9ca0b0",
    string: {
      base: "#40a02b",
      special: "#179299",
    },
    number: "#fe640b",
    keyword: "#8839ef",
    type: "#df8e1d",
    function: "#1e66f5",
    variable: "#4c4f69",
    parameter: "#dc8a78",
    constant: "#fe640b",
    attribute: "#d20f39",
    tag: "#e64553",
    punctuation: "#6c6f85",
  },
});

const frappe = buildTheme({
  id: "frappe",
  name: "Catppuccin Frappe",
  palette: {
    background: {
      base: "#303446",
      panel: {
        base: "#292c3c",
        muted: "#414559",
        alt: "#51576d",
        border: "#626880",
      },
    },
    text: {
      primary: "#c6d0f5",
      muted: "#a5adce",
    },
    accent: {
      red: "#e78284",
      green: "#a6d189",
      yellow: "#e5c890",
      blue: "#8caaee",
    },
  },
  syntax: {
    text: "#c6d0f5",
    comment: "#737994",
    string: {
      base: "#a6d189",
      special: "#81c8be",
    },
    number: "#ef9f76",
    keyword: "#ca9ee6",
    type: "#e5c890",
    function: "#8caaee",
    variable: "#c6d0f5",
    parameter: "#f2d5cf",
    constant: "#ef9f76",
    attribute: "#e78284",
    tag: "#ea999c",
    punctuation: "#a5adce",
  },
});

const macchiato = buildTheme({
  id: "macchiato",
  name: "Catppuccin Macchiato",
  palette: {
    background: {
      base: "#24273a",
      panel: {
        base: "#1e2030",
        muted: "#363a4f",
        alt: "#494d64",
        border: "#5b6078",
      },
    },
    text: {
      primary: "#cad3f5",
      muted: "#a5adcb",
    },
    accent: {
      red: "#ed8796",
      green: "#a6da95",
      yellow: "#eed49f",
      blue: "#8aadf4",
    },
  },
  syntax: {
    text: "#cad3f5",
    comment: "#6e738d",
    string: {
      base: "#a6da95",
      special: "#8bd5ca",
    },
    number: "#f5a97f",
    keyword: "#c6a0f6",
    type: "#eed49f",
    function: "#8aadf4",
    variable: "#cad3f5",
    parameter: "#f4dbd6",
    constant: "#f5a97f",
    attribute: "#ed8796",
    tag: "#ee99a0",
    punctuation: "#a5adcb",
  },
});

const mocha = buildTheme({
  id: "mocha",
  name: "Catppuccin Mocha",
  palette: {
    background: {
      base: "#1e1e2e",
      panel: {
        base: "#181825",
        muted: "#313244",
        alt: "#45475a",
        border: "#585b70",
      },
    },
    text: {
      primary: "#cdd6f4",
      muted: "#a6adc8",
    },
    accent: {
      red: "#f38ba8",
      green: "#a6e3a1",
      yellow: "#f9e2af",
      blue: "#89b4fa",
    },
  },
  syntax: {
    text: "#cdd6f4",
    comment: "#6c7086",
    string: {
      base: "#a6e3a1",
      special: "#94e2d5",
    },
    number: "#fab387",
    keyword: "#cba6f7",
    type: "#f9e2af",
    function: "#89b4fa",
    variable: "#cdd6f4",
    parameter: "#f5e0dc",
    constant: "#fab387",
    attribute: "#f38ba8",
    tag: "#eba0ac",
    punctuation: "#a6adc8",
  },
});

const rosePine = buildTheme({
  id: "rose-pine",
  name: "Rose Pine",
  palette: {
    background: {
      base: "#191724",
      panel: {
        base: "#21202e",
        muted: "#1f1d2e",
        alt: "#26233a",
        border: "#524f67",
      },
    },
    text: {
      primary: "#e0def4",
      muted: "#6e6a86",
    },
    accent: {
      red: "#eb6f92",
      green: "#31748f",
      yellow: "#f6c177",
      blue: "#9ccfd8",
    },
  },
  syntax: {
    text: "#e0def4",
    comment: "#6e6a86",
    string: {
      base: "#f6c177",
      special: "#ebbcba",
    },
    number: "#ebbcba",
    keyword: "#31748f",
    type: "#9ccfd8",
    function: "#ebbcba",
    variable: "#e0def4",
    parameter: "#c4a7e7",
    constant: "#ebbcba",
    attribute: "#9ccfd8",
    tag: "#9ccfd8",
    punctuation: "#908caa",
  },
});

const rosePineMoon = buildTheme({
  id: "rose-pine-moon",
  name: "Rose Pine Moon",
  palette: {
    background: {
      base: "#232136",
      panel: {
        base: "#2a283e",
        muted: "#2a273f",
        alt: "#393552",
        border: "#56526e",
      },
    },
    text: {
      primary: "#e0def4",
      muted: "#6e6a86",
    },
    accent: {
      red: "#eb6f92",
      green: "#3e8fb0",
      yellow: "#f6c177",
      blue: "#9ccfd8",
    },
  },
  syntax: {
    text: "#e0def4",
    comment: "#6e6a86",
    string: {
      base: "#f6c177",
      special: "#ea9a97",
    },
    number: "#ea9a97",
    keyword: "#3e8fb0",
    type: "#9ccfd8",
    function: "#ea9a97",
    variable: "#e0def4",
    parameter: "#c4a7e7",
    constant: "#ea9a97",
    attribute: "#9ccfd8",
    tag: "#9ccfd8",
    punctuation: "#908caa",
  },
});

const rosePineDawn = buildTheme({
  id: "rose-pine-dawn",
  name: "Rose Pine Dawn",
  palette: {
    background: {
      base: "#faf4ed",
      panel: {
        base: "#f4ede8",
        muted: "#fffaf3",
        alt: "#f2e9e1",
        border: "#cecacd",
      },
    },
    text: {
      primary: "#575279",
      muted: "#9893a5",
    },
    accent: {
      red: "#b4637a",
      green: "#286983",
      yellow: "#ea9d34",
      blue: "#56949f",
    },
  },
  syntax: {
    text: "#575279",
    comment: "#9893a5",
    string: {
      base: "#ea9d34",
      special: "#d7827e",
    },
    number: "#d7827e",
    keyword: "#286983",
    type: "#56949f",
    function: "#d7827e",
    variable: "#575279",
    parameter: "#907aa9",
    constant: "#d7827e",
    attribute: "#56949f",
    tag: "#56949f",
    punctuation: "#797593",
  },
});

export const themes: Theme[] = [
  latte,
  frappe,
  macchiato,
  mocha,
  rosePine,
  rosePineMoon,
  rosePineDawn,
];

export const themeById: Record<ThemeId, Theme> = themes.reduce(
  (acc, theme) => {
    acc[theme.id] = theme;
    return acc;
  },
  {} as Record<ThemeId, Theme>
);

export const defaultThemeId: ThemeId = "mocha";

export const getNextThemeId = (current: ThemeId, direction: 1 | -1 = 1): ThemeId => {
  const index = themeOrder.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + direction + themeOrder.length) % themeOrder.length;
  return themeOrder[nextIndex] ?? defaultThemeId;
};
