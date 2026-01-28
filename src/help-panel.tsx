import type { ThemeColors, ThemeName } from "./theme";

type HelpPanelProps = {
  colors: ThemeColors;
  themeName: ThemeName;
};

export function HelpPanel(props: HelpPanelProps) {
  const globalLines = [
    "? help | q/esc quit | r refresh",
    `p files | t themes (${props.themeName})`,
    "j/k/up/down move line",
    "v multi-select (j/k expand)",
    "mouse drag select | c comment selection",
    "y copy comments (file)",
  ];

  const filePanelLines = [
    "search active on open",
    "ctrl+n/ctrl+p/up/down move",
    "enter select | esc close",
  ];
  const themePanelLines = [
    "enter select | t/esc close",
    "j/k/up/down move",
  ];
  const commentLines = ["enter save | ctrl+j/alt+enter newline | esc close"];

  return (
    <box
      width="100%"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="row"
      gap={4}
      backgroundColor={props.colors.mantle}
    >
      <box width="52%" flexDirection="column" gap={1}>
        <text fg={props.colors.subtext0}>Global</text>
        {globalLines.map((line) => (
          <text key={line} fg={props.colors.text}>
            {line}
          </text>
        ))}
      </box>
      <box width="48%" flexDirection="column" gap={1}>
        <text fg={props.colors.subtext0}>Panels</text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Files</span>: {filePanelLines[0]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Files</span>: {filePanelLines[1]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Files</span>: {filePanelLines[2]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Themes</span>: {themePanelLines[0]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Themes</span>: {themePanelLines[1]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Comment</span>: {commentLines[0]}
        </text>
      </box>
    </box>
  );
}
