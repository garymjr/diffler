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
      return colors.green;
    case "copied":
      return colors.green;
    case "deleted":
      return colors.red;
    case "conflict":
      return colors.red;
    case "untracked":
      return colors.yellow;
    default:
      return colors.blue;
  }
}
