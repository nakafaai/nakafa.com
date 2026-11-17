/**
 * A space a line may break at: any white space but the no-break ones (U+00A0,
 * U+2007, U+202F, U+FEFF), and the zero-width space, which is no white space
 * but a break opportunity.
 */
const BREAK = /[^\S   ﻿]|​/u;

/**
 * Splits the text that follows an inline formula into the part that touches
 * the formula, up to the first space a line may break at, and the rest. The
 * touching part is what the author wrote against the formula: a full stop, a
 * comma, a closing bracket, a unit after a no-break space, or a suffix such as
 * Indonesian "-nya". A browser may break a line between a formula and the text
 * after it, because a formula's pieces are boxes of their own, so the renderer
 * keeps the touching part on the formula's line. Text that starts with a space
 * touches nothing, and text without one touches the formula whole.
 */
export function splitTouching(text: string) {
  const index = text.search(BREAK);
  const end = index === -1 ? text.length : index;
  return { rest: text.slice(end), touching: text.slice(0, end) };
}
