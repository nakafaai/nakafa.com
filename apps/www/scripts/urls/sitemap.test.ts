// @vitest-environment node

import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { readSitemapPaths } from "@/scripts/urls/sitemap";

const ORIGIN = "https://nakafa.com";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** A sitemap document that lists the given locations. */
function listing(locations: readonly string[]) {
  return Arr.join(
    Arr.map(locations, (location) => `<loc>${location}</loc>`),
    ""
  );
}

/** Answers each requested address with the document the table gives it. */
function serve(table: Record<string, string>) {
  fetcher.mockImplementation((input) => {
    const url = input instanceof Request ? input.url : `${input}`;
    const body = table[url];
    return Promise.resolve(
      body === undefined
        ? new Response(null, { status: 404 })
        : new Response(body, { status: 200 })
    );
  });
}

/** Reads the sitemap paths with the stubbed fetch. */
function read() {
  return readSitemapPaths(ORIGIN).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("readSitemapPaths", () => {
  it.effect(
    "reads every sitemap the index names and keeps the site's paths",
    () =>
      Effect.gen(function* () {
        serve({
          [`${ORIGIN}/sitemap.xml`]: listing([
            `${ORIGIN}/sitemap/base.xml`,
            `${ORIGIN}/sitemap/page_en.xml`,
          ]),
          [`${ORIGIN}/sitemap/base.xml`]: listing([
            `${ORIGIN}/en`,
            `${ORIGIN}/id`,
          ]),
          [`${ORIGIN}/sitemap/page_en.xml`]: listing([
            `${ORIGIN}/en/about`,
            "https://example.com/elsewhere",
          ]),
        });

        expect(yield* read()).toStrictEqual(["/en", "/id", "/en/about"]);
      })
  );

  it.effect("fails when a sitemap does not answer 200", () =>
    Effect.gen(function* () {
      serve({
        [`${ORIGIN}/sitemap.xml`]: listing([`${ORIGIN}/sitemap/missing.xml`]),
      });

      const result = yield* Effect.result(read());

      assert(Result.isFailure(result));
    })
  );
});
