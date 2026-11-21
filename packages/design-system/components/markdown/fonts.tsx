"use client";

import type { MathFont } from "@repo/design-system/lib/markdown/fonts";
import { MATH_FONT_FILES } from "@repo/design-system/lib/markdown/fonts";
import type { ReactNode } from "react";
import { createContext, use } from "react";
import { preload } from "react-dom";

/** Whether the formulas under it draw only after the page's first screen. */
const DrawnLater = createContext(false);

/**
 * Holds back the math faces of the formulas under it, which the page draws only
 * after its first screen, such as a landing section whose layout the browser
 * skips until it nears the screen. Their faces load when the browser first lays
 * the formulas out, instead of beside the first screen's stylesheet and fonts:
 * two preloaded KaTeX faces, about 44 KB, took a share of a slow phone's
 * connection while the home page waited for its stylesheet (ADR 0039 D19).
 */
export function LaterMath({ children }: { readonly children: ReactNode }) {
  return <DrawnLater value>{children}</DrawnLater>;
}

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
  const later = use(DrawnLater);
  if (!later && typeof window === "undefined") {
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
