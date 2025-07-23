import type { ThemeProviderProps } from "next-themes";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./providers/theme";

type Properties = ThemeProviderProps;

export function DesignSystemProvider({ children, ...properties }: Properties) {
  return (
    <ThemeProvider {...properties}>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
