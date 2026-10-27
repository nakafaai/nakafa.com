import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Order } from "effect";
import type { Locale } from "use-intl";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntries } from "@/lib/sitemap/entries";

/** The segments that name the search screen, which the build never renders. */
const SEARCH_SEGMENT = "search";

/** The try-out family segment, which every locale spells the same way. */
const TRYOUT_SEGMENT = "try-out";

/** The articles index, which no sitemap page lists as one URL. */
const ARTICLES_SEGMENT = "articles";

/**
 * Whether a path is left out of the static build: the search screen, whose answer
 * depends on its query. A path is `/<locale>/<family>/...`. The sitemap lists the
 * same paths, so it names only the pages that the build writes.
 */
export function isExcludedPath(path: string): boolean {
  const [, , family] = path.split("/");
  return family === SEARCH_SEGMENT;
}

/**
 * Selects the public paths that the build prerenders: the sitemap's URLs without
 * the search screen, try-out tracks, sets and sections included, plus the articles
 * index and the try-out hub of every locale, which no sitemap page lists. The
 * result is unique and sorted, so the build and its verifier compare the same list.
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
