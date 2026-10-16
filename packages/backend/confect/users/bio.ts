import { pipe, Result, Schema, String as Str } from "effect";

/**
 * The most characters a bio holds. A character is a Unicode code point, so an
 * emoji counts once and a bio of 160 emoji is allowed. A count shown beside the
 * field must count the same way.
 */
export const BIO_MAX_LENGTH = 160;

const WHITE_SPACE = /\s+/g;

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
 * Tidies what a person typed into the text of a bio. A bio is one line, so every
 * run of white space becomes one space and the ends are trimmed. The settings
 * page counts and saves with this same text, so both agree.
 */
export function tidyBio(input: string): string {
  return pipe(input, Str.replaceAll(WHITE_SPACE, " "), Str.trim);
}

/**
 * Reads what a person typed as a bio: the tidied text, when it fits the limit.
 * A text that is empty after tidying is no bio.
 */
export function readBio(input: string): Result.Result<string, BioTooLong> {
  const bio = tidyBio(input);
  return fitsBio(bio) ? Result.succeed(bio) : Result.fail(new BioTooLong());
}
