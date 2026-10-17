import {
  countPostCharacters,
  POST_TEXT_MAX_LENGTH,
} from "@repo/backend/confect/posts/schema";
import { Option, String as Str } from "effect";

/** The characters left at which the composer starts to show how many remain. */
const SHOW_REMAINING_FROM = 50;

/**
 * How many characters the learner has left, once fewer than fifty remain and
 * the text is within the limit. The count uses the text the server would store,
 * so the white space at its ends does not count. Past the limit no count is
 * left to show, so nothing shows.
 */
export function remainingToShow(input: string): Option.Option<number> {
  const remaining = POST_TEXT_MAX_LENGTH - countPostCharacters(Str.trim(input));
  return remaining >= 0 && remaining <= SHOW_REMAINING_FROM
    ? Option.some(remaining)
    : Option.none();
}
