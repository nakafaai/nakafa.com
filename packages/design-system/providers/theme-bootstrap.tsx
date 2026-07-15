import { createThemeBootstrapScript } from "@repo/design-system/lib/theme/bootstrap";
import {
  DEFAULT_THEME,
  type ThemeValue,
} from "@repo/design-system/lib/theme/registry";

interface ThemeBootstrapProps {
  defaultTheme?: ThemeValue;
}

/** Applies persisted theme state from the document head before first paint. */
export function ThemeBootstrap({
  defaultTheme = DEFAULT_THEME,
}: ThemeBootstrapProps) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: The source is generated only from the static theme registry and contains no user input.
      dangerouslySetInnerHTML={{
        __html: createThemeBootstrapScript(defaultTheme),
      }}
      id="nakafa-theme-bootstrap"
      suppressHydrationWarning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
    />
  );
}
