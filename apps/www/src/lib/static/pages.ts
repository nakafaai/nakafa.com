import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Order } from "effect";
import type { Locale } from "use-intl";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntries } from "@/lib/sitemap/entries";

/** The sign-in page, which the sitemap leaves out because it is no content. */
const SIGN_IN_SEGMENT = "auth";

/** The try-out family segment, which every locale spells the same way. */
const TRYOUT_SEGMENT = "try-out";

/** The segments of a try-out section's path: `/<locale>/try-out/<country>/<exam>/<group>/<track>/<set>/<section>`. */
const TRYOUT_SECTION_SEGMENTS = 9;

/** The Quran family segment, which every locale spells the same way. */
const QURAN_SEGMENT = "quran";

/** The search page segment, which every locale spells the same way. */
const SEARCH_SEGMENT = "search";

/**
 * Whether the sitemap leaves out a page that the build still writes, because
 * its head keeps it out of search indexes: a try-out section, which its set
 * stands for in search; the Quran index and every surah, whose text comes from
 * third parties; and the search page, a search box with no content of its own.
 */
export function isUnlistedPath(path: string): boolean {
  const segments = path.split("/");
  const family = segments[2];
  if (family === TRYOUT_SEGMENT) {
    return segments.length === TRYOUT_SECTION_SEGMENTS;
  }
  return family === QURAN_SEGMENT || family === SEARCH_SEGMENT;
}

/**
 * Selects the public paths that the build prerenders: the sitemap's URLs, try-out
 * tracks, sets and sections included, plus the sign-in page of every locale,
 * which no sitemap page lists. The result is unique and
 * sorted, so the build and its verifier compare the same list.
 */
export function selectStaticPagePaths({
  locales,
  sitemapPaths,
}: {
  readonly locales: readonly Locale[];
  readonly sitemapPaths: readonly string[];
}): string[] {
  const signIns = Arr.map(locales, (locale) => `/${locale}/${SIGN_IN_SEGMENT}`);
  return Arr.sort(
    Arr.dedupe(Arr.appendAll(sitemapPaths, signIns)),
    Order.String
  );
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
