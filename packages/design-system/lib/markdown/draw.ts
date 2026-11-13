import { MATH_ERROR_COLOR } from "@repo/design-system/lib/prose";
import katex from "katex";

/**
 * KaTeX's markup of one formula, the one way every formula is drawn: trust stays
 * off, so the markup is safe to set as HTML, and a formula KaTeX cannot read is
 * drawn in the error color instead of throwing.
 */
export function drawMath(
  math: string,
  displayMode: boolean,
  errorColor: string = MATH_ERROR_COLOR
) {
  return katex.renderToString(math, {
    displayMode,
    errorColor,
    throwOnError: false,
    trust: false,
  });
}
