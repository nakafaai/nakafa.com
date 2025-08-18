import { themes } from "@repo/design-system/lib/theme";
import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemeProvider } from "next-themes";

export const ThemeProvider = ({
  children,
  ...properties
}: ThemeProviderProps) => (
  <NextThemeProvider
    attribute="class"
    defaultTheme="light"
    disableTransitionOnChange
    enableSystem
    themes={themes.map((t) => t.value)}
    {...properties}
  >
    {children}
  </NextThemeProvider>
);
