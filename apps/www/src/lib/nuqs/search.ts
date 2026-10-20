import { Effect, Schema } from "effect";
import { parseAsString } from "nuqs/server";

export const searchParsers = {
  q: parseAsString.withDefault(""),
};

/**
 * The search query of the URL, as the route reads it. A URL without `q`, or with
 * a value that is not one text, searches for nothing.
 */
export const SearchInput = Schema.Struct({
  q: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
}).pipe(Schema.catchDecoding(() => Effect.succeedSome({ q: "" })));
