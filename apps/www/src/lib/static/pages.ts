import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Order } from "effect";
import type { Locale } from "use-intl";
import { signInPath } from "@/lib/routing/signin";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntries } from "@/lib/sitemap/entries";

/** The segments that name the search screen, which the build never renders. */
const SEARCH_SEGMENT = "search";

/**
 * The try-out family segment, which every locale spells the same way. A track, a
 * set and a section read the learner's attempts, so they stay on the Worker.
 */
const TRYOUT_SEGMENT = "try-out";

/**
 * The segments after the try-out family that name a track (`<exam>/<year>`), which
 * a set (`set-1`) and a section extend.
 */
const TRYOUT_TRACK_SEGMENTS = 3;

/** The articles index, which no sitemap page lists as one URL. */
const ARTICLES_SEGMENT = "articles";

/**
 * Whether a path is left out of the static build: the search screen, and a try-out
 * track, set or section. A path is `/<locale>/<family>/...`. The sitemap lists the
 * same paths, so it names only the pages that the build writes.
 */
export function isExcludedPath(path: string): boolean {
  const [, , family, ...rest] = path.split("/");
  if (family === SEARCH_SEGMENT) {
    return true;
  }
  return family === TRYOUT_SEGMENT && rest.length >= TRYOUT_TRACK_SEGMENTS;
}

/**
 * Selects the public paths that the build prerenders: the sitemap's URLs without
 * the search screen and the try-out tracks, sets and sections, plus the articles
 * index, the try-out hub and the sign-in page of every locale, which no sitemap
 * page lists. The result is unique and sorted, so the build and its verifier
 * compare the same list.
 */
export function selectStaticPagePaths({
  locales,
  sitemapPaths,
}: {
  readonly locales: readonly Locale[];
  readonly sitemapPaths: readonly string[];
}): string[] {
  const listed = Arr.filter(sitemapPaths, (path) => !isExcludedPath(path));
  const indexes = Arr.flatMap(locales, (locale) => [
    `/${locale}/${ARTICLES_SEGMENT}`,
    `/${locale}/${TRYOUT_SEGMENT}`,
    signInPath(locale),
  ]);
  return Arr.sort(Arr.dedupe(Arr.appendAll(listed, indexes)), Order.String);
}

/** Reads the public paths of the active release that the build prerenders, in a stable order. */
export const readStaticPagePaths = Effect.fn("www.static.pages")(function* () {
  const descriptors = yield* readSitemapPageDescriptors();
  const pages = yield* Effect.forEach(
    descriptors,
    ({ id }) => getSitemapEntries({ pageId: id }),
    { concurrency: 8 }
  );
  return selectStaticPagePaths({
    locales: LOCALES,
    sitemapPaths: Arr.flatMap(pages, (entries) =>
      Arr.map(entries, (entry) => new URL(entry.url).pathname)
    ),
  });
});
