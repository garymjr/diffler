import type { ThemeColors } from "./theme";

type HelpPanelProps = {
  colors: ThemeColors;
  themeName: string;
};

export function HelpPanel(props: HelpPanelProps) {
  const globalLines = [
    "? help | q/esc quit | r refresh",
    `p files | t themes (${props.themeName})`,
    "j/k/up/down jump hunk | v multi-select",
    "mouse drag select | c comment | y copy comments",
  ];

  const panelLines = [
    "All panels: esc close",
    "Files/Themes: move ctrl+n/p or up/down",
    "Files/Themes: select enter",
    "Comment: save enter | newline ctrl+j/alt+enter",
    "Comment: scroll ctrl+u/d",
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
        {panelLines.map((line) => (
          <text key={line} fg={props.colors.text.primary}>
            {line}
          </text>
        ))}
      </box>
    </box>
  );
}
