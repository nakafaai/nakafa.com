import { themes } from "@repo/design-system/lib/theme";
import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemeProvider } from "next-themes";

const concreteThemeValues = themes.flatMap((theme) =>
  theme.appearance === "dynamic" ? [] : [theme.value]
);

/** Configures Nakafa's concrete themes and delegates system resolution to next-themes. */
export const ThemeProvider = ({
  children,
  ...properties
}: ThemeProviderProps) => (
  <NextThemeProvider
    attribute="class"
    defaultTheme="light"
    disableTransitionOnChange
    enableSystem
    themes={concreteThemeValues}
    {...properties}
  >
    {children}
  </NextThemeProvider>
);
