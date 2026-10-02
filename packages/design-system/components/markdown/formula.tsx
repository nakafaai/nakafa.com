"use client";

import {
  MATH_FONT_FILES,
  readMathFonts,
} from "@repo/design-system/lib/markdown/fonts";
import {
  type PackedMathMarkup,
  unpackMathMarkup,
} from "@repo/design-system/lib/markdown/markup";
import { preload } from "react-dom";

interface FormulaProps {
  /** Block formulas render in a `div`; inline formulas stay in the line. */
  readonly display?: "block" | "inline";
  readonly markup: PackedMathMarkup;
}

/**
 * Draws one formula from its packed KaTeX markup, so the RSC payload carries
 * each formula in its compact form.
 *
 * The server render also preloads the faces the formula draws, so the browser
 * loads them with the page instead of when its first layout finds the
 * formula, which would reflow the text around it. React lists each face once
 * per response, whichever formulas draw it.
 *
 * Only the server render preloads. A server component's preload would travel
 * in the page's payload and reach every page that prefetches it, and Chromium
 * never matches a font preload inserted by script with the stylesheet's font
 * request, so a browser render would fetch the face twice and warn that the
 * preload went unused.
 */
export function Formula({ display = "inline", markup }: FormulaProps) {
  const html = unpackMathMarkup(markup);

  if (typeof window === "undefined") {
    for (const font of readMathFonts(html)) {
      preload(MATH_FONT_FILES[font], {
        as: "font",
        crossOrigin: "anonymous",
        type: "font/woff2",
      });
    }
  }

  if (display === "block") {
    return (
      <div
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="katex"
      />
    );
  }

  return (
    <span
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
      dangerouslySetInnerHTML={{ __html: html }}
      data-testid="katex"
    />
  );
}
