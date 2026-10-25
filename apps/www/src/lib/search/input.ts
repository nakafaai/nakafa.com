import { Effect, Schema } from "effect";
import { QueryText } from "@/lib/routing/search";

/**
 * The search query of the URL, as the route reads it. A URL without `q`, or with
 * a value that is not one text, searches for nothing.
 */
export const SearchInput = Schema.Struct({
  q: QueryText.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
}).pipe(Schema.catchDecoding(() => Effect.succeedSome({ q: "" })));

/** The query text of a search URL, read from its parsed search object. */
export function readSearchQuery(search: unknown) {
  return Schema.decodeUnknownSync(SearchInput)(search).q;
}
