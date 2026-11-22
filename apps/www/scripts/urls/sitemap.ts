import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect } from "effect";
import { HttpClient } from "effect/http";
import { toLedgerPath } from "@/scripts/urls/ledger";

/** One address that a sitemap or a sitemap index lists. */
const LOCATION = /<loc>(?<location>[^<]*)<\/loc>/gu;

/** The locations that one sitemap document lists. */
function readLocations(xml: string): readonly string[] {
  // Each match holds the whole element, then the one captured location.
  return Arr.flatMap([...xml.matchAll(LOCATION)], (found) =>
    Arr.drop(found, 1)
  );
}

/** The text of one sitemap document, failing on any status but 200. */
const readDocument = Effect.fn("scripts.urls.readSitemapDocument")(function* (
  url: string
) {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
  const response = yield* client.get(url);
  return yield* response.text;
});

/**
 * Every page path that the site's sitemap lists now: the sitemap index at
 * `/sitemap.xml`, then each sitemap it names. A deploy reads it before it
 * replaces the site, so the ledger keeps every page the old site published.
 */
export const readSitemapPaths = Effect.fn("scripts.urls.readSitemapPaths")(
  function* (origin: string) {
    const index = yield* readDocument(new URL("/sitemap.xml", origin).href);
    const files = yield* Effect.forEach(readLocations(index), readDocument, {
      concurrency: 4,
    });
    return Arr.getSomes(
      Arr.map(Arr.flatMap(files, readLocations), (location) =>
        toLedgerPath(location, origin)
      )
    );
  },
  Effect.provide(FetchClient)
);
