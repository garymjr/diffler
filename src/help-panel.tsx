import type { ThemeColors } from "./theme";

type HelpPanelProps = {
  colors: ThemeColors;
  themeName: string;
};

export function HelpPanel(props: HelpPanelProps) {
  const globalLines = [
    "? help | q/esc quit | r refresh",
    `p files | t themes (${props.themeName})`,
    "j/k/up/down jump hunk",
    "v multi-select",
    "mouse drag select | c comment hunk",
    "y copy comments (file)",
  ];

  const filePanelLines = [
    "search active on open",
    "ctrl+n/ctrl+p/up/down move",
    "enter select | esc close",
  ];
  const themePanelLines = [
    "search active on open",
    "ctrl+n/ctrl+p/up/down move",
    "enter select | esc close",
  ];
  const commentLines = ["enter save | ctrl+j/alt+enter newline | ctrl+u/ctrl+d scroll hunk | esc close"];

  return (
    <box
      width="100%"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="row"
      gap={4}
      backgroundColor={props.colors.panel.base}
    >
      <box width="52%" flexDirection="column" gap={1}>
        <text fg={props.colors.text.muted}>Global</text>
        {globalLines.map((line) => (
          <text key={line} fg={props.colors.text.primary}>
            {line}
          </text>
        ))}
      </box>
      <box width="48%" flexDirection="column" gap={1}>
        <text fg={props.colors.text.muted}>Panels</text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Files</span>: {filePanelLines[0]}
        </text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Files</span>: {filePanelLines[1]}
        </text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Files</span>: {filePanelLines[2]}
        </text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Themes</span>: {themePanelLines[0]}
        </text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Themes</span>: {themePanelLines[1]}
        </text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Themes</span>: {themePanelLines[2]}
        </text>
        <text fg={props.colors.text.primary}>
          <span fg={props.colors.text.muted}>Comment</span>: {commentLines[0]}
        </text>
      </box>
    </box>
  );
}
