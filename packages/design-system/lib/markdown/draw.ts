import { MATH_ERROR_COLOR } from "@repo/design-system/lib/prose";
import katex from "katex";

/**
 * KaTeX's markup of one formula, the one way every formula is drawn: trust stays
 * off, so the markup is safe to set as HTML, and a formula KaTeX cannot read is
 * drawn in the theme's error color instead of throwing. The theme owns that
 * color: no formula overrides it.
 */
export function drawMath(math: string, displayMode: boolean) {
  return katex.renderToString(math, {
    displayMode,
    errorColor: MATH_ERROR_COLOR,
    throwOnError: false,
    trust: false,
  });
}
