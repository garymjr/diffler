import type { ThemeColors, ThemeName } from "./theme";

type HelpPanelProps = {
  colors: ThemeColors;
  themeName: ThemeName;
};

export function HelpPanel(props: HelpPanelProps) {
  const globalLines = [
    "? help | q/esc quit | r refresh",
    `p files | t themes (${props.themeName})`,
    "h/l/left/right file | j/k scroll",
    "mouse drag select | c comment selection",
    "y copy comments (file)",
  ];

  const panelLines = [
    "enter select | esc close",
    "j/k/up/down move",
    "type to filter | backspace delete",
  ];

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
          <span fg={props.colors.subtext0}>Files</span>: {panelLines[0]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Files</span>: {panelLines[1]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Files</span>: {panelLines[2]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Themes</span>: {panelLines[0]}
        </text>
        <text fg={props.colors.text}>
          <span fg={props.colors.subtext0}>Themes</span>: {panelLines[1]}
        </text>
      </box>
    </box>
  );
}
