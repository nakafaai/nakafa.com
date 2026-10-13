import { pipe, Result, Schema, String as Str } from "effect";

/** The most characters a bio holds, counted the way every length check counts. */
export const BIO_MAX_LENGTH = 160;

const WHITE_SPACE = /\s+/g;

/** A bio that holds more than the limit. */
export class BioTooLong extends Schema.TaggedError<BioTooLong>()(
  "BioTooLong",
  {}
) {}

/**
 * Reads what a person typed as a bio. A bio is one line, so every run of white
 * space becomes one space and the ends are trimmed. A text that is empty after
 * that is no bio.
 */
export function readBio(input: string): Result.Result<string, BioTooLong> {
  const bio = pipe(input, Str.replaceAll(WHITE_SPACE, " "), Str.trim);
  return Str.length(bio) > BIO_MAX_LENGTH
    ? Result.fail(new BioTooLong())
    : Result.succeed(bio);
}
