import { For } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ChangeItem, ChangeStatus } from "./types";
import type { ThemeColors } from "./theme";

type ChangesPanelProps = {
  isOpen: boolean;
  isSearchActive: boolean;
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
    <box
      width="28%"
      minWidth={26}
      maxWidth={44}
      height="100%"
      border
      borderStyle="single"
      borderColor={props.isOpen ? props.colors.blue : props.colors.surface2}
      title="Files"
      titleAlignment="left"
      padding={1}
      flexDirection="column"
      gap={1}
      backgroundColor={props.colors.mantle}
    >
      <box flexDirection="row" alignItems="center" gap={1}>
        <input
          value={props.query}
          onInput={handleInput}
          placeholder="Filter files..."
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
              const selectedBg = () => (isSelected() ? props.colors.blue : "transparent");
              const selectedFg = () => (isSelected() ? props.colors.base : props.colors.text);
              return (
                <box
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={selectedBg()}
                >
                  <box flexDirection="row" gap={1}>
                    <text
                      fg={isSelected() ? props.colors.base : props.statusColor(entry.status)}
                    >
                      {props.statusLabel(entry.status)}
                    </text>
                    <text fg={selectedFg()}>
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
  );
}
