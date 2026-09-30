"use client";

import {
  MATH_FONT_FILES,
  type MathFont,
} from "@repo/design-system/lib/markdown/fonts";
import { preload } from "react-dom";

/**
 * Preloads the faces one formula draws while the server renders the page, so
 * the browser loads them with the page instead of when its first layout finds
 * the formula, which would reflow the text around it. React lists each face
 * once per response, whichever formulas draw it.
 *
 * Only the server render preloads. A server component's preload would travel
 * in the page's payload and reach every page that prefetches it, and Chromium
 * never matches a font preload inserted by script with the stylesheet's font
 * request, so a browser render would fetch the face twice and warn that the
 * preload went unused.
 */
export function MathFontPreload({
  fonts,
}: {
  readonly fonts: readonly MathFont[];
}) {
  if (typeof window === "undefined") {
    for (const font of fonts) {
      preload(MATH_FONT_FILES[font], {
        as: "font",
        crossOrigin: "anonymous",
        type: "font/woff2",
      });
    }
  }
  return null;
}
