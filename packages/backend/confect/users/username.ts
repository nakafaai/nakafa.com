import { pipe, Result, Schema, String as Str } from "effect";

/** The fewest characters a username holds. */
export const USERNAME_MIN_LENGTH = 3;

/** The most characters a username holds. */
export const USERNAME_MAX_LENGTH = 20;

const ALLOWED_CHARACTERS = /^[a-z0-9_]*$/;
const STARTS_WITH_LETTER = /^[a-z]/;

/**
 * Why the text of a username cannot be one. Each reason is a sentence of the
 * settings page: only lowercase letters, digits, and underscores (`characters`),
 * a letter first (`letterFirst`), at least three characters (`tooShort`), and
 * the name cannot be used (`notAllowed`), which also answers a text that is
 * too long and a name that is reserved.
 */
const UsernameFormatRefusal = Schema.Literals([
  "characters",
  "letterFirst",
  "tooShort",
  "notAllowed",
]);

/** Why a username cannot be taken: its text is refused, or another account holds it. */
export const UsernameRefusal = Schema.Literals([
  ...UsernameFormatRefusal.literals,
  "taken",
]);

/** What checking a username answers: it can be taken, or the reason it cannot. */
export const UsernameCheck = Schema.Literals([
  "available",
  ...UsernameRefusal.literals,
]);

/** A rename that was refused, with the reason a person reads. */
export class UsernameRejected extends Schema.TaggedError<UsernameRejected>()(
  "UsernameRejected",
  { reason: UsernameRefusal }
) {}

/**
 * Reads what a person typed as a username. Capitals are accepted and spaces
 * around the text are dropped, and the username is the lowercase text that is
 * left. It holds only lowercase letters, digits, and underscores, because a dot
 * would end the address in a file extension that the site already answers for
 * the Markdown and image versions of a page. It starts with a letter and holds
 * three to twenty characters.
 *
 * The reasons come in the order a person fixes them: a character that must go,
 * the first character, and the length last, because typing more fixes it.
 */
export function readUsername(
  input: string
): Result.Result<string, typeof UsernameFormatRefusal.Type> {
  const username = pipe(input, Str.trim, Str.toLowerCase);
  if (!ALLOWED_CHARACTERS.test(username)) {
    return Result.fail("characters");
  }
  if (username !== "" && !STARTS_WITH_LETTER.test(username)) {
    return Result.fail("letterFirst");
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return Result.fail("notAllowed");
  }
  if (username.length < USERNAME_MIN_LENGTH) {
    return Result.fail("tooShort");
  }
  return Result.succeed(username);
}
