import { Array as Arr, Result, Schema, String as Str } from "effect";

/**
 * The most characters a post holds. A character is a Unicode code point, as
 * Threads counts them, so an emoji counts once.
 */
export const POST_TEXT_MAX_LENGTH = 500;

/** The text a post stores: trimmed, with one to `POST_TEXT_MAX_LENGTH` characters. */
export const postTextValidator = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isBetweenCodePoints(1, POST_TEXT_MAX_LENGTH)
);

/** Why a text is refused as a post. */
export const PostTextRefusal = Schema.Literals([
  "POST_TEXT_EMPTY",
  "POST_TEXT_TOO_LONG",
]);

/** The number of characters in a text, which is its number of Unicode code points. */
export function countPostCharacters(text: string): number {
  return Arr.length(Arr.fromIterable(text));
}

/**
 * The characters a post has left before the limit, counted on the text the
 * server would store, so the white space at its ends does not count. The
 * composer shows this number, and it agrees with `readPostText`.
 */
export function remainingPostCharacters(input: string): number {
  return POST_TEXT_MAX_LENGTH - countPostCharacters(Str.trim(input));
}

/**
 * Reads what a person typed as a post: the text without the white space at its
 * ends, when it has at least one character and at most the limit. The composer
 * and the server both read a text with this function, so they agree.
 */
export function readPostText(
  input: string
): Result.Result<string, typeof PostTextRefusal.Type> {
  const text = Str.trim(input);
  if (Str.isEmpty(text)) {
    return Result.fail("POST_TEXT_EMPTY");
  }
  if (countPostCharacters(text) > POST_TEXT_MAX_LENGTH) {
    return Result.fail("POST_TEXT_TOO_LONG");
  }
  return Result.succeed(text);
}
