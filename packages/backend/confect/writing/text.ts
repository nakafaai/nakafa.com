import { Array as Arr, Result, Schema, String as Str } from "effect";

/**
 * The most characters a learner's text holds, in a post or a comment. A character
 * is a Unicode code point, as Threads counts them, so an emoji counts once.
 */
export const LEARNER_TEXT_MAX_LENGTH = 500;

/**
 * The text a learner's post or comment stores: trimmed, with one to
 * `LEARNER_TEXT_MAX_LENGTH` characters.
 */
export const learnerTextValidator = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isBetweenCodePoints(1, LEARNER_TEXT_MAX_LENGTH)
);

/**
 * Why a text is refused. The codes keep their post names, because `posts.create`
 * answers them to deployed clients, and a rename needs its own rollout.
 */
export const LearnerTextRefusal = Schema.Literals([
  "POST_TEXT_EMPTY",
  "POST_TEXT_TOO_LONG",
]);

/** The number of characters in a text, which is its number of Unicode code points. */
export function countLearnerCharacters(text: string): number {
  return Arr.length(Arr.fromIterable(text));
}

/**
 * Reads what a person typed as a post or a comment: the text without the white
 * space at its ends, when it has at least one character and at most the limit.
 * The composer and the server both read a text with this function, so they agree.
 */
export function readLearnerText(
  input: string
): Result.Result<string, typeof LearnerTextRefusal.Type> {
  const text = Str.trim(input);
  if (Str.isEmpty(text)) {
    return Result.fail("POST_TEXT_EMPTY");
  }
  if (countLearnerCharacters(text) > LEARNER_TEXT_MAX_LENGTH) {
    return Result.fail("POST_TEXT_TOO_LONG");
  }
  return Result.succeed(text);
}
