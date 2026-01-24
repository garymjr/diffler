import { For, Show } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ChangeItem, ChangeStatus } from "./types";
import type { ThemeColors } from "./theme";

type ChangesPanelProps = {
  isOpen: boolean;
  query: string;
  entries: ChangeItem[];
  selectedIndex: number;
  colors: ThemeColors;
  statusLabel: (status: ChangeStatus | undefined) => string;
  statusColor: (status: ChangeStatus | undefined) => string;
  onQueryChange: (value: string) => void;
  onScrollRef?: (el: ScrollBoxRenderable) => void;
};

export function ChangesPanel(props: ChangesPanelProps) {
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
          width="35%"
          height="25%"
          border
          borderStyle="rounded"
          borderColor={props.colors.crust}
          padding={1}
          flexDirection="column"
          gap={1}
          backgroundColor={props.colors.crust}
        >
          <box flexDirection="row" alignItems="center" gap={1}>
            <input
              value={props.query}
              onInput={handleInput}
              placeholder="Filter files..."
              flexGrow={1}
              focused={false}
              backgroundColor={props.colors.mantle}
              textColor={props.colors.text}
              placeholderColor={props.colors.subtext0}
              cursorColor={props.colors.blue}
            />
          </box>
          <box flexGrow={1} height="100%">
            <scrollbox
              height="100%"
              key={`${props.query}-${props.entries.length}`}
              ref={(el) => {
                if (el && props.onScrollRef) props.onScrollRef(el);
              }}
            >
              <For
                each={props.entries}
                fallback={<text fg={props.colors.subtext0}>No matching files.</text>}
              >
                {(entry, index) => {
                  const isSelected = () => index() === props.selectedIndex;
                  return (
                    <box
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={
                        isSelected() ? props.colors.blue : "transparent"
                      }
                    >
                      <box flexDirection="row" gap={1}>
                        <text
                          fg={isSelected() ? props.colors.base : props.statusColor(entry.status)}
                        >
                          {props.statusLabel(entry.status)}
                        </text>
                        <text fg={isSelected() ? props.colors.base : props.colors.text}>
                          {entry.path}
                        </text>
                      </box>
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </box>
        </box>
      </box>
    </Show>
  );
}
