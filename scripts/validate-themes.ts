import { themes } from "../src/theme";

const requiredPalettePaths = [
  "palette.background.base",
  "palette.background.panel.base",
  "palette.background.panel.muted",
  "palette.background.panel.alt",
  "palette.background.panel.border",
  "palette.text.primary",
  "palette.text.muted",
  "palette.accent.red",
  "palette.accent.green",
  "palette.accent.yellow",
  "palette.accent.blue",
];

const requiredSyntaxPaths = [
  "syntax.text",
  "syntax.comment",
  "syntax.string.base",
  "syntax.string.special",
  "syntax.number",
  "syntax.keyword",
  "syntax.type",
  "syntax.function",
  "syntax.variable",
  "syntax.parameter",
  "syntax.constant",
  "syntax.attribute",
  "syntax.tag",
  "syntax.punctuation",
];

const getPath = (value: unknown, path: string) => {
  const parts = path.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const validateHex = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

const errors: string[] = [];

for (const theme of themes) {
  for (const path of requiredPalettePaths) {
    const value = getPath(theme, path);
    if (!validateHex(value)) {
      errors.push(`${theme.id}: invalid ${path}`);
    }
  }
  for (const path of requiredSyntaxPaths) {
    const value = getPath(theme, path);
    if (!validateHex(value)) {
      errors.push(`${theme.id}: invalid ${path}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Theme validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
} else {
  console.log(`Theme validation passed (${themes.length} themes).`);
}
