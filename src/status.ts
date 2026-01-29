import type { ChangeStatus } from "./types";
import type { ThemeColors } from "./theme";

export function statusLabel(status: ChangeStatus | undefined) {
  switch (status) {
    case "added":
      return "A";
    case "copied":
      return "C";
    case "deleted":
      return "D";
    case "conflict":
      return "U";
    case "untracked":
      return "??";
    default:
      return "M";
  }
}

export function statusColor(status: ChangeStatus | undefined, colors: ThemeColors) {
  switch (status) {
    case "added":
      return colors.accent.green;
    case "copied":
      return colors.accent.green;
    case "deleted":
      return colors.accent.red;
    case "conflict":
      return colors.accent.red;
    case "untracked":
      return colors.accent.yellow;
    default:
      return colors.accent.blue;
  }
}
