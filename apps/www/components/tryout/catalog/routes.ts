import { Effect, Predicate, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
} from "@/components/tryout/catalog/server";

/** Expected failure while listing the catalog pages a build prerenders. */
class TryoutCatalogRouteError extends Schema.TaggedError<TryoutCatalogRouteError>()(
  "TryoutCatalogRouteError",
  {
    cause: Schema.Unknown,
    publicPath: Schema.String,
  }
) {}

/**
 * Reads one catalog page its parent lists. A listed page the catalog cannot
 * serve fails the build instead of prerendering a missing route.
 */
function readListedPage<Page>(
  publicPath: string,
  read: () => Promise<Page | null>
) {
  return Effect.tryPromise({
    catch: (cause) => new TryoutCatalogRouteError({ cause, publicPath }),
    try: read,
  }).pipe(
    Effect.filterOrFail(
      Predicate.isNotNull,
      () =>
        new TryoutCatalogRouteError({
          cause: "The catalog does not serve a page it lists.",
          publicPath,
        })
    )
  );
}

/** Reads the route segment that ends one published catalog path. */
function readRouteSegment(publicPath: string) {
  return publicPath.slice(publicPath.lastIndexOf("/") + 1);
}

/**
 * Lists the route segments of every country, exam, and track page the
 * published catalog serves, so each one prerenders whole, app shell included,
 * instead of opening on the generic App Shell its first visitor would get.
 *
 * @see https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components
 */
export const readTryoutCatalogRoutes = Effect.fn(
  "www.tryout.catalog.readRoutes"
)(function* (locale: Locale) {
  const hub = yield* readListedPage("try-out", () => readTryoutHubPage(locale));
  const countries = yield* Effect.forEach(hub.countries, ({ publicPath }) =>
    readListedPage(publicPath, () => readTryoutCountryPage(locale, publicPath))
  );
  const exams = countries.flatMap((page) =>
    page.exams.map((exam) => ({
      country: readRouteSegment(page.country.publicPath),
      exam: readRouteSegment(exam.publicPath),
      publicPath: exam.publicPath,
    }))
  );
  const tracks = yield* Effect.forEach(exams, ({ country, exam, publicPath }) =>
    readListedPage(publicPath, () =>
      readTryoutExamPage(locale, publicPath)
    ).pipe(
      Effect.map((page) =>
        page.tracks.map((track) => ({
          country,
          exam,
          track: readRouteSegment(track.publicPath),
        }))
      )
    )
  );

  return {
    countries: countries.map((page) => ({
      country: readRouteSegment(page.country.publicPath),
    })),
    exams: exams.map(({ country, exam }) => ({ country, exam })),
    tracks: tracks.flat(),
  };
});
