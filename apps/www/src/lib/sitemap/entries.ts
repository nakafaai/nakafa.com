import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { publicInternalHref } from "@repo/internationalization/src/href";
import { LOCALES } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { cache } from "react";
import type { Locale } from "use-intl";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

/** One sitemap URL as the origin cache stores it, with its date as text. */
const SitemapPageUrl = Schema.Struct({
  lastModified: Schema.optionalKey(Schema.String),
  url: Schema.String,
});

const SitemapPageFound = Schema.TaggedStruct("Found", {
  entries: Schema.Array(SitemapPageUrl),
});
const SitemapPageMissing = Schema.TaggedStruct("Missing", {});

/**
 * The outcome of one sitemap page read as it crosses the origin cache.
 *
 * A cached function rethrows its failure to the caller as a new error
 * without the original class, so a missing page travels as data instead of as
 * a thrown `SitemapPageNotFoundError`.
 */
const SitemapPageRead = Schema.Union([SitemapPageFound, SitemapPageMissing]);

/** Optional settings shared by the sitemap route and standalone indexing scripts. */
const SitemapEntryOptions = Schema.Struct({
  lastModified: Schema.optionalKey(Schema.String),
  locales: Schema.Array(ActiveAppLocaleCodeSchema),
});
type SitemapEntryOptions = typeof SitemapEntryOptions.Type;

const SitemapPageEntryOptions = Schema.Struct({
  pageId: Schema.String,
});
type SitemapPageEntryOptions = typeof SitemapPageEntryOptions.Type;

const SitemapRouteEntry = Schema.Struct({
  lastModified: Schema.optionalKey(Schema.String),
  path: Schema.String,
});
type SitemapRouteEntry = typeof SitemapRouteEntry.Type;

/** Expands one route into canonical localized sitemap entries. */
function getEntries(href: string, options: SitemapEntryOptions) {
  return Arr.map(options.locales, (locale) => ({
    ...(options.lastModified === undefined
      ? {}
      : { lastModified: options.lastModified }),
    url: getUrl(href, locale),
  }));
}

/** Converts an app href and locale into an absolute canonical URL. */
function getUrl(href: string, locale: Locale): string {
  const mappedPathname = getLocalizedMappedRoutePathname({
    locale,
    route: href,
  });

  return Option.match(mappedPathname, {
    onNone: () => SITE_ORIGIN + publicInternalHref(href, locale),
    onSome: (pathname) => `${SITE_ORIGIN}/${locale}${pathname}`,
  });
}

/** Generates entries for one bounded sitemap page. */
export const getSitemapEntries = Effect.fn("www.sitemap.entries.page")(
  function* (options: SitemapPageEntryOptions) {
    const pageId = options.pageId;
    const page = yield* readSitemapRoutePage(pageId);
    const routes: readonly SitemapRouteEntry[] = page.routes;
    const locales = getSitemapEntryLocales(pageId);
    const entries: (typeof SitemapPageUrl.Type)[] = Arr.flatMap(
      routes,
      (route) =>
        getEntries(route.path, {
          ...(route.lastModified === undefined
            ? {}
            : { lastModified: route.lastModified }),
          locales,
        })
    );

    return entries;
  }
);

/** Selects all locales for base pages and one locale for content pages. */
function getSitemapEntryLocales(pageId: string) {
  const descriptor = getSitemapPageDescriptor(pageId);

  if (descriptor && "kind" in descriptor) {
    return [descriptor.locale];
  }

  return LOCALES;
}

/**
 * Reads one bounded sitemap page. The page id names the family, the locale and
 * the partition. Every Convex read behind the page goes through the content
 * store, so a page is built from Convex only once for each release. The page
 * itself, with its URLs, is derived on every read, so a deploy that changes the
 * routing or the origin takes effect at once. The outcome is built through
 * `SitemapPageRead`, so only plain, serializable data is returned.
 */
async function readCachedSitemapEntries(
  options: SitemapPageEntryOptions
): Promise<typeof SitemapPageRead.Type> {
  return await Effect.runPromise(
    getSitemapEntries(options).pipe(
      Effect.flatMap((entries) => SitemapPageFound.makeEffect({ entries })),
      Effect.catchTag("SitemapPageNotFoundError", () =>
        Effect.succeed(SitemapPageMissing.make({}))
      )
    )
  );
}

/** Shares one cached sitemap page between the route and indexing scripts
 * in a single render pass. https://react.dev/reference/react/cache */
export const getCachedSitemapEntries = cache(readCachedSitemapEntries);
