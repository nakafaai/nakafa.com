import { ThemeProvider } from "@repo/design-system/providers/theme";
import type { ThemeProviderProps } from "next-themes";

type Properties = ThemeProviderProps;

export function DesignSystemProvider({ children, ...properties }: Properties) {
  return <ThemeProvider {...properties}>{children}</ThemeProvider>;
}
