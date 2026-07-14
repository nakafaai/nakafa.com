import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme-compatibility";
import type { Viewport } from "next";

/** Browser viewport and color-scheme metadata shared by every app document. */
export const appViewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: THEME_COMPATIBILITY_COLORS.light.background,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: THEME_COMPATIBILITY_COLORS.dark.background,
    },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
} satisfies Viewport;
