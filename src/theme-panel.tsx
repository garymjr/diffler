import { For, Show } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { Theme, ThemeColors } from "./theme";

type ThemePanelProps = {
  isOpen: boolean;
  isSearchActive: boolean;
  query: string;
  themes: Theme[];
  selectedIndex: number;
  colors: ThemeColors;
  onQueryChange: (value: string) => void;
  onScrollRef?: (el: ScrollBoxRenderable) => void;
};

export function ThemePanel(props: ThemePanelProps) {
  const handleInput = (value: unknown) => {
    if (typeof value === "string") {
      props.onQueryChange(value);
      return;
    }
    if (value && typeof value === "object" && "value" in value) {
      const next = (value as { value?: string }).value ?? "";
      props.onQueryChange(next);
      return;
    }
    props.onQueryChange("");
  };

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
          width="40%"
          height="45%"
          minWidth={28}
          minHeight={10}
          title="Themes"
          titleAlignment="left"
          padding={1}
          flexDirection="column"
          gap={1}
          backgroundColor={props.colors.crust}
        >
          <box flexDirection="row" alignItems="center" gap={1}>
            <input
              value={props.query}
              onInput={handleInput}
              placeholder="Filter themes..."
              flexGrow={1}
              focused={props.isSearchActive}
              backgroundColor={props.isSearchActive ? props.colors.surface0 : props.colors.base}
              textColor={props.colors.text}
              placeholderColor={props.colors.subtext0}
              cursorColor={props.colors.blue}
            />
          </box>
          <box flexGrow={1} height="100%">
            <scrollbox
              height="100%"
              key={`${props.query}-${props.themes.length}`}
              ref={(el) => {
                if (el && props.onScrollRef) props.onScrollRef(el);
              }}
            >
              <For
                each={props.themes}
                fallback={
                  <text fg={props.colors.subtext0}>
                    No matches. <span fg={props.colors.subtext0}>Esc</span> to clear filter.
                  </text>
                }
              >
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
