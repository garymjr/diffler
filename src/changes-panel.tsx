import { For, Show } from "solid-js";
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
        zIndex={4}
      >
        <box
          width="62%"
          height="65%"
          minWidth={48}
          minHeight={12}
          title="Files"
          titleAlignment="left"
          padding={1}
          flexDirection="column"
          gap={1}
          backgroundColor={props.colors.panel.base}
        >
          <box flexDirection="row" alignItems="center" gap={1}>
            <input
              value={props.query}
              onInput={handleInput}
              placeholder="Filter files..."
              flexGrow={1}
              focused={props.isSearchActive}
              backgroundColor={
                props.isSearchActive ? props.colors.panel.muted : props.colors.background.base
              }
              textColor={props.colors.text.primary}
              placeholderColor={props.colors.text.muted}
              cursorColor={props.colors.accent.blue}
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
                fallback={
                  <text fg={props.colors.text.muted}>
                    No matches. <span fg={props.colors.text.muted}>Esc</span> to clear filter.
                  </text>
                }
              >
                {(entry, index) => {
                  const isSelected = () => index() === props.selectedIndex;
                  const selectedBg = () => (isSelected() ? props.colors.accent.blue : "transparent");
                  const selectedFg = () =>
                    isSelected() ? props.colors.background.base : props.colors.text.primary;
                  const added = () => entry.added ?? 0;
                  const deleted = () => entry.deleted ?? 0;
                  const hunks = () => entry.hunks ?? 0;
                  const addedLabel = () => `+${added()}`.padStart(5, " ");
                  const deletedLabel = () => `-${deleted()}`.padStart(5, " ");
                  const hunksLabel = () => `~${hunks()}`.padStart(4, " ");
                  return (
                    <box
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={selectedBg()}
                      height={1}
                    >
                      <box flexDirection="row" gap={1} alignItems="center" flexWrap="no-wrap" height={1}>
                        <text
                          fg={
                            isSelected() ? props.colors.background.base : props.statusColor(entry.status)
                          }
                        >
                          {props.statusLabel(entry.status)}
                        </text>
                        <box flexGrow={1} flexShrink={1} minWidth={0}>
                          <text fg={selectedFg()} wrapMode="none" truncate>
                            {entry.path}
                          </text>
                        </box>
                        <box flexDirection="row" gap={0} alignItems="center" flexShrink={0}>
                          <text
                            fg={isSelected() ? props.colors.background.base : props.colors.accent.green}
                          >
                            {addedLabel()}
                          </text>
                          <text fg={isSelected() ? props.colors.background.base : props.colors.accent.red}>
                            {deletedLabel()}
                          </text>
                          <text
                            fg={isSelected() ? props.colors.background.base : props.colors.accent.blue}
                          >
                            {hunksLabel()}
                          </text>
                        </box>
                      </box>
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </box>
          <text fg={props.colors.text.muted}>enter select  esc close</text>
        </box>
      </box>
    </Show>
  );
}
