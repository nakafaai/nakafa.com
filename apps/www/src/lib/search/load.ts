import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { SearchIndex, searchIndexPath } from "@/lib/search/entry";
import { prepareEntry } from "@/lib/search/rank";

/** The search index of the locale could not be read, so the palette says so and offers the full search. */
export class SearchIndexUnavailable extends Schema.TaggedError<
  SearchIndexUnavailable,
  { readonly brand: unique symbol }
>()("SearchIndexUnavailable", {
  reason: Schema.Literals(["body", "fetch", "status"]),
}) {}

/**
 * Reads the static search index of a locale from the assets of the host the
 * page came from (a relative address resolves against the page), once,
 * when the reader opens the palette, and folds its words for every keystroke
 * after it. No search reads anything but this file.
 */
export const readSearchIndex = Effect.fn("www.search.readIndex")(function* (
  locale: string
) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .get(searchIndexPath(locale))
    .pipe(
      Effect.mapError(() => new SearchIndexUnavailable({ reason: "fetch" }))
    );
  if (response.status !== 200) {
    return yield* new SearchIndexUnavailable({ reason: "status" });
  }
  const index = yield* HttpClientResponse.schemaBodyJson(SearchIndex)(
    response
  ).pipe(Effect.mapError(() => new SearchIndexUnavailable({ reason: "body" })));
  return {
    entries: index.entries,
    prepared: Arr.map(index.entries, prepareEntry),
  };
}, Effect.provide(FetchClient));
