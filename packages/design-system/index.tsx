import { ThemeProvider } from "@repo/design-system/providers/theme";
import { MotionConfig } from "motion/react";
import type { ThemeProviderProps } from "next-themes";

type Properties = ThemeProviderProps;

/** Applies Nakafa's theme and user-level reduced-motion policy to the app. */
export function DesignSystemProvider({ children, ...properties }: Properties) {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider {...properties}>{children}</ThemeProvider>
    </MotionConfig>
  );
}
