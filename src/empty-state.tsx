import { Show } from "solid-js";
import type { ThemeColors } from "./theme";

type EmptyStateProps = {
  title: string;
  subtitle: string;
  hint?: string;
  colors: ThemeColors;
};

export function EmptyState(props: EmptyStateProps) {
  return (
    <box width="100%" height="100%" justifyContent="center" alignItems="center">
      <box flexDirection="column" alignItems="center" gap={1}>
        <ascii_font text={props.title} font="tiny" />
        <text fg={props.colors.subtext0}>{props.subtitle}</text>
        <Show when={props.hint}>
          {(hint) => <text fg={props.colors.subtext0}>{hint()}</text>}
        </Show>
      </box>
    </box>
  );
}
