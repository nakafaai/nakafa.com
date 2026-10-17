import { DirectionProvider } from "@base-ui/react/direction-provider";
import { ThemeProvider } from "@repo/design-system/providers/theme";
import type { TextDirection } from "@repo/internationalization/src/direction";
import { MotionConfig } from "motion/react";
import type { ThemeProviderProps } from "next-themes";

type DesignSystemProviderProps = ThemeProviderProps & {
  direction?: TextDirection;
};

/**
 * Applies Nakafa's theme, the user's reduced-motion policy, and the reading
 * direction of the locale to the app. Base UI's parts follow the direction. A
 * document with no locale, such as the global error page, keeps Base UI's
 * default of left to right.
 */
export function DesignSystemProvider({
  children,
  direction,
  ...properties
}: DesignSystemProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      <DirectionProvider direction={direction}>
        <ThemeProvider {...properties}>{children}</ThemeProvider>
      </DirectionProvider>
    </MotionConfig>
  );
}
