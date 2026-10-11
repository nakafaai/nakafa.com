import { Predicate, String as Str } from "effect";

const decoder = new TextDecoder();

/**
 * Whether a stored value shows a text: a string that holds it, or bytes that
 * decode to a string that holds it. A sealed value must not, so a table export
 * shows no readable text.
 */
export function showsText(
  stored: string | ArrayBuffer | undefined,
  text: string
) {
  if (stored === undefined) {
    return false;
  }
  const shown = Predicate.isString(stored) ? stored : decoder.decode(stored);
  return Str.includes(text)(shown);
}
