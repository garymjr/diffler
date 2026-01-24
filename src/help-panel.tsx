import type { ThemeColors, ThemeName } from "./theme";

type HelpPanelProps = {
  colors: ThemeColors;
  themeName: ThemeName;
};

export function HelpPanel(props: HelpPanelProps) {
  return (
    <box
      width="100%"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="row"
      gap={6}
      backgroundColor={props.colors.mantle}
    >
      <box width="45%" flexDirection="column" gap={0}>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.subtext0}>Global</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>? help</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>q/esc quit</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>r refresh</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>p files</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>t themes ({props.themeName})</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>h/l/left/right file  j/k scroll</text>
        </box>
      </box>
      <box width="55%" flexDirection="column" gap={0}>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.subtext0}>Panels</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>Files: enter select, esc close</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>Files: j/k/up/down move</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>Files: type to filter, backspace delete</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>Themes: enter select, esc close</text>
        </box>
        <box width="100%" backgroundColor={props.colors.mantle}>
          <text fg={props.colors.text}>Themes: j/k/up/down move</text>
        </box>
      </box>
    </box>
  );
}
