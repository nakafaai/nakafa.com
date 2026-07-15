import {
  concreteThemeValues,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
} from "@repo/design-system/lib/theme/registry";
import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemeProvider } from "next-themes";

/** Configures Nakafa's concrete themes and delegates system resolution to next-themes. */
export const ThemeProvider = ({
  children,
  ...properties
}: ThemeProviderProps) => (
  <NextThemeProvider
    attribute="class"
    defaultTheme={DEFAULT_THEME}
    disableTransitionOnChange
    enableSystem
    storageKey={THEME_STORAGE_KEY}
    themes={concreteThemeValues}
    {...properties}
  >
    {children}
  </NextThemeProvider>
);
