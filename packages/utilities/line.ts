import { Schema } from "effect";

/**
 * A check that a text is one line: it holds no control character and no line or
 * paragraph separator. A text that goes in a list row or in the subject of an
 * email must pass it, because a line break ends the row and ends the header.
 */
export const isSingleLine = Schema.isPattern(/^[^\p{Cc}\p{Zl}\p{Zp}]*$/u, {
  message: "Expected one line of text.",
});
