import { For, Show } from "solid-js";
import type { Theme, ThemeColors } from "./theme";

type ThemePanelProps = {
  isOpen: boolean;
  themes: Theme[];
  selectedIndex: number;
  colors: ThemeColors;
};

export function ThemePanel(props: ThemePanelProps) {
  return (
    <Show when={props.isOpen}>
      <box
        position="absolute"
        left={0}
        top={0}
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor="transparent"
      >
        <box
          width="30%"
          height="22%"
          border
          borderStyle="rounded"
          borderColor={props.colors.crust}
          padding={1}
          flexDirection="column"
          gap={1}
          backgroundColor={props.colors.crust}
        >
          <text fg={props.colors.subtext0}>Themes</text>
          <box flexGrow={1} height="100%">
            <scrollbox height="100%">
              <For each={props.themes}>
                {(theme, index) => {
                  const isSelected = () => index() === props.selectedIndex;
                  return (
                    <box
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={isSelected() ? props.colors.blue : "transparent"}
                    >
                      <text fg={isSelected() ? props.colors.base : props.colors.text}>
                        {theme.name}
                      </text>
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </box>
          <text fg={props.colors.subtext0}>enter select  esc close</text>
        </box>
      </box>
    </Show>
  );
}
