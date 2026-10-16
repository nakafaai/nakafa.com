import { Array as Arr, pipe, Result, Schema, String as Str } from "effect";

/**
 * The most characters a bio holds. A character is a Unicode code point, so an
 * emoji counts once and a bio of 160 emoji is allowed. A count shown beside the
 * field must count the same way.
 */
export const BIO_MAX_LENGTH = 160;

const LINE_BREAK = /\r\n?/g;
const BLANK_LINES = /\n{3,}/g;

/** Whether a text holds at most `BIO_MAX_LENGTH` code points. */
const fitsBio = Schema.is(
  Schema.String.check(Schema.isMaxCodePoints(BIO_MAX_LENGTH))
);

/** A bio that holds more than the limit. */
export class BioTooLong extends Schema.TaggedError<BioTooLong>()(
  "BioTooLong",
  {}
) {}

/**
 * Tidies what a person typed into a bio. Every line break becomes `\n`, each line
 * loses the white space at its ends, and three or more line breaks in a row
 * become two, so the lines of a bio stay apart and at most one blank line sits
 * between them. The ends of the whole text are trimmed too. The settings page
 * counts and saves with this same text, so both agree.
 */
export function tidyBio(input: string): string {
  return pipe(
    input,
    Str.replaceAll(LINE_BREAK, "\n"),
    Str.split("\n"),
    Arr.map((line) => Str.trim(line)),
    Arr.join("\n"),
    Str.replaceAll(BLANK_LINES, "\n\n"),
    Str.trim
  );
}

/**
 * Reads what a person typed as a bio: the tidied text, when it fits the limit.
 * A text that is empty after tidying is no bio.
 */
export function readBio(input: string): Result.Result<string, BioTooLong> {
  const bio = tidyBio(input);
  return fitsBio(bio) ? Result.succeed(bio) : Result.fail(new BioTooLong());
}
