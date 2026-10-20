import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { TextDirection } from "@repo/internationalization/src/direction";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

interface DesignSystemProviderProps {
  children: ReactNode;
  direction?: TextDirection;
}

/**
 * Applies the user's reduced-motion policy and the reading direction of the
 * locale to the app. Base UI's parts follow the direction. A document with no
 * locale, such as the global error page, keeps Base UI's default of left to
 * right. The theme is mounted once at the root, from providers/theme.
 */
export function DesignSystemProvider({
  children,
  direction,
}: DesignSystemProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      <DirectionProvider direction={direction}>{children}</DirectionProvider>
    </MotionConfig>
  );
}
