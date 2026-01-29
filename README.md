# Diffler

TUI diff browser for your current git working tree, built with OpenTUI + Solid.

## Features

- Unified diffs for staged + unstaged changes
- Status badges (added/modified/deleted/renamed/copied/untracked/conflict)
- File picker with search
- Syntax-highlighted diffs + line numbers

## Themes

Add a theme by creating a `ThemeDefinition` in `src/theme.ts` and include its `id` in `themeOrder`.

```ts
const example = {
  id: "solar",
  name: "Solar",
  palette: {
    background: {
      base: "#101010",
      panel: {
        base: "#161616",
        muted: "#1c1c1c",
        alt: "#232323",
        border: "#2b2b2b",
      },
    },
    text: {
      primary: "#f2f2f2",
      muted: "#a0a0a0",
    },
    accent: {
      red: "#ff5f7a",
      green: "#7bd88f",
      yellow: "#f2cc60",
      blue: "#6cb6ff",
    },
  },
  syntax: {
    text: "#f2f2f2",
    comment: "#6b6b6b",
    string: {
      base: "#7bd88f",
      special: "#f2cc60",
    },
    number: "#f2cc60",
    keyword: "#6cb6ff",
    type: "#f2cc60",
    function: "#ff5f7a",
    variable: "#f2f2f2",
    parameter: "#6cb6ff",
    constant: "#f2cc60",
    attribute: "#6cb6ff",
    tag: "#6cb6ff",
    punctuation: "#a0a0a0",
  },
};
```


## Requirements

- Bun
- Git

## Run

```bash
bun install
bun dev
```

Run inside a git repo.

Staged-only mode:

```bash
bun dev -- --staged
```

Watch mode (auto-refresh on repo changes):

```bash
bun dev -- --watch
```

## Controls

Global:

- `q` / `esc`: quit
- `r`: refresh
- `p`: file picker
- `h` / `l` / `←` / `→`: previous/next file
- `j` / `k`: scroll diff

File picker:

- Type to filter
- `enter`: open file
- `esc`: close
- `j` / `k` / `↑` / `↓`: move
- `ctrl+p` / `ctrl+n`: move
