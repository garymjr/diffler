# Diffler

TUI diff browser for your current git working tree, built with OpenTUI + Solid.

## Features

- Unified diffs for staged + unstaged changes
- Status badges (added/modified/deleted/renamed/copied/untracked/conflict)
- File picker with search
- Syntax-highlighted diffs + line numbers

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
