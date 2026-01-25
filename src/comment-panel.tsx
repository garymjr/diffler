import { Show, createEffect } from "solid-js";
import type { KeyBinding, TextareaRenderable } from "@opentui/core";
import type { ThemeColors } from "./theme";
import type { SelectionInfo } from "./comments";

const commentKeyBindings: KeyBinding[] = [
  { name: "enter", action: "submit" },
  { name: "j", ctrl: true, action: "newline" },
  { name: "enter", meta: true, action: "newline" },
];

type CommentPanelProps = {
  isOpen: boolean;
  isFocused: boolean;
  colors: ThemeColors;
  selection: SelectionInfo | null;
  comment: string;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
};

export function CommentPanel(props: CommentPanelProps) {
  let textareaRef: TextareaRenderable | undefined;

  createEffect(() => {
    if (!props.isOpen) return;
    if (!textareaRef) return;
    const next = props.comment ?? "";
    if (textareaRef.plainText !== next) {
      textareaRef.editBuffer.setText(next);
    }
  });

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
          width="70%"
          height="60%"
          border
          borderStyle="rounded"
          borderColor={props.colors.crust}
          padding={1}
          flexDirection="column"
          gap={1}
          backgroundColor={props.colors.crust}
        >
          <text fg={props.colors.text}>Add comment</text>
          <box flexDirection="column" gap={0}>
            <text fg={props.colors.subtext0}>{props.selection?.filePath ?? "No selection"}</text>
            <Show when={props.selection?.lineLabel}>
              {(label) => <text fg={props.colors.subtext0}>Lines: {label()}</text>}
            </Show>
          </box>
          <box border borderStyle="rounded" padding={1} backgroundColor={props.colors.mantle}>
            <scrollbox height={6}>
              <Show
                when={props.selection?.text}
                fallback={<text fg={props.colors.subtext0}>Select lines in the diff.</text>}
              >
                {(text) => <text selectable>{text()}</text>}
              </Show>
            </scrollbox>
          </box>
          <textarea
            ref={(el) => {
              textareaRef = el ?? undefined;
            }}
            onContentChange={() => {
              props.onCommentChange(textareaRef?.plainText ?? "");
            }}
            placeholder="Type comment..."
            height={6}
            focused={props.isFocused}
            keyBindings={commentKeyBindings}
            onSubmit={props.onSubmit}
            backgroundColor={props.colors.mantle}
            textColor={props.colors.text}
            placeholderColor={props.colors.subtext0}
            cursorColor={props.colors.blue}
          />
          <text fg={props.colors.subtext0}>Enter save  Ctrl+J/Alt+Enter newline  Esc cancel</text>
        </box>
      </box>
    </Show>
  );
}
