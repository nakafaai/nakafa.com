import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider } from "./providers/theme";

type Properties = ThemeProviderProps;

export function DesignSystemProvider({ children, ...properties }: Properties) {
  return <ThemeProvider {...properties}>{children}</ThemeProvider>;
}
