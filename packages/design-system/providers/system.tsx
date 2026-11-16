import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { TextDirection } from "@repo/internationalization/src/direction";
import type { ReactNode } from "react";

interface DesignSystemProviderProps {
  children: ReactNode;
  direction?: TextDirection;
}

/**
 * Applies the reading direction of the locale to the app. Base UI's parts
 * follow the direction. A document with no locale, such as the global error
 * page, keeps Base UI's default of left to right. The root document mounts the
 * theme once, from providers/theme. Motion's reduced-motion policy stays with
 * each part that moves, so no page loads Motion before it draws.
 */
export function DesignSystemProvider({
  children,
  direction,
}: DesignSystemProviderProps) {
  return (
    <DirectionProvider direction={direction}>{children}</DirectionProvider>
  );
}
