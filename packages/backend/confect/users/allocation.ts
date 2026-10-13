import { inspectUsername } from "@repo/backend/confect/users/availability";
import { USERNAME_MAX_LENGTH } from "@repo/backend/confect/users/username";
import {
  Array as Arr,
  Effect,
  pipe,
  Random,
  Schema,
  String as Str,
} from "effect";

/** The name of an account that has no letter or digit of the Latin alphabet to start from. */
const FALLBACK_NAME = "teman";
const COMBINING_MARKS = /\p{M}/gu;
const OUTSIDE_LATIN_ALPHANUMERIC = /[^a-z0-9]/g;
const LEADING_DIGITS = /^[0-9]+/;

/** The largest number a name takes in order: `siti`, `siti2`, and on to `siti9`. */
const LAST_ORDERED_NUMBER = 9;

/** The digits of the random numbers, shortest first: a crowded name grows a longer number. */
const RANDOM_DIGITS = Arr.range(2, 8);

/** The random numbers drawn at one digit count before the next digit count. */
const DRAWS_PER_DIGITS = 2;

/** Every name that one allocation tried was taken. Only a flood of accounts of one name can cause it. */
export class UsernameExhausted extends Schema.TaggedError<UsernameExhausted>()(
  "UsernameExhausted",
  { tries: Schema.Finite }
) {}

/**
 * The letters and digits of a name, as far as a username can hold them: accents
 * drop, so "Wiśniewska" becomes "wisniewska", and a username starts with a
 * letter, so leading digits drop. A name with nothing left, such as one in
 * another script, becomes the fallback.
 */
function nameToUsername(name: string) {
  const username = pipe(
    name,
    Str.normalize("NFD"),
    Str.replaceAll(COMBINING_MARKS, ""),
    Str.toLowerCase,
    Str.replaceAll(OUTSIDE_LATIN_ALPHANUMERIC, ""),
    Str.replace(LEADING_DIGITS, ""),
    Str.takeLeft(USERNAME_MAX_LENGTH)
  );
  return username === "" ? FALLBACK_NAME : username;
}

/** The name with its suffix, cut short so that both fit in a username. */
function withSuffix(base: string, suffix: string) {
  return Str.takeLeft(base, USERNAME_MAX_LENGTH - suffix.length) + suffix;
}

/** A number of `digits` digits that does not start with zero, drawn when its turn comes. */
function randomSuffix(digits: number) {
  return Random.nextIntBetween(10 ** (digits - 1), 10 ** digits - 1).pipe(
    Effect.map((number) => `${number}`)
  );
}

/** Nothing, then 2 up to 9: the names that come before any random number. */
const ORDERED_SUFFIXES = [
  "",
  ...Arr.map(Arr.range(2, LAST_ORDERED_NUMBER), (number) => `${number}`),
];

/**
 * What each try adds to the name, in order: the ordered suffixes, then random
 * numbers of two digits, then of three, and so on. A random number is drawn
 * only when its turn comes.
 */
const SUFFIXES = [
  ...Arr.map(ORDERED_SUFFIXES, (suffix) => Effect.succeed(suffix)),
  ...Arr.flatMap(RANDOM_DIGITS, (digits) =>
    Arr.replicate(randomSuffix(digits), DRAWS_PER_DIGITS)
  ),
];

/**
 * The most usernames one allocation tries, and so the most index reads it makes,
 * however many accounts share the name.
 */
export const MAX_ALLOCATION_TRIES = SUFFIXES.length;

/**
 * Gives an account the first username that is free for its name: the name
 * itself, then the name with 2 up to 9 in order, then the name with a random
 * number that gains a digit after repeated collisions. Each try is one index
 * read, so a name that thousands of accounts share costs no more than a rare
 * one. A try that is too short or reserved is passed over without a read, so
 * "Jo" becomes `jo2`. The caller writes the username in the same transaction,
 * so two accounts that ask for the same name at once cannot both win.
 */
export const allocateUsername = Effect.fn("users.allocation.allocate")(
  function* (name: string) {
    const base = nameToUsername(name);
    const allocated = yield* Effect.findFirstFilter(SUFFIXES, (suffix) =>
      Effect.flatMap(suffix, (text) => inspectUsername(withSuffix(base, text)))
    );
    return yield* Effect.fromOption(
      allocated,
      () => new UsernameExhausted({ tries: MAX_ALLOCATION_TRIES })
    ).pipe(Effect.orDie);
  }
);
