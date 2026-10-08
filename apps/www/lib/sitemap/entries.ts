import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "next-intl";
import { cache } from "react";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import { applySitemapCache } from "@/lib/sitemap/cache";
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
 * Next.js rethrows a cached function's failure to its caller as a new error
 * without the original class, so a missing page travels as data instead of as
 * a thrown `SitemapPageNotFoundError`.
 */
export const SitemapPageRead = Schema.Union([
  SitemapPageFound,
  SitemapPageMissing,
]);

/** Optional settings shared by the Next route and standalone indexing scripts. */
interface SitemapEntryOptions {
  lastModified?: string;
  locales: readonly Locale[];
}

interface SitemapPageEntryOptions {
  pageId: string;
}

interface SitemapRouteEntry {
  readonly lastModified?: string;
  readonly path: string;
}

const host = `https://${MAIN_DOMAIN}`;

/** Expands one route into canonical localized sitemap entries. */
function getEntries(href: string, options: SitemapEntryOptions) {
  return options.locales.map((locale) => ({
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
    onNone: () => host + getPathname({ locale, href, forcePrefix: true }),
    onSome: (pathname) => `${host}/${locale}${pathname}`,
  });
}

/** Generates entries for one bounded sitemap page. */
export const getSitemapEntries = Effect.fn("www.sitemap.entries.page")(
  function* (options: SitemapPageEntryOptions) {
    const pageId = options.pageId;
    const page = yield* readSitemapRoutePage(pageId);
    const routes: readonly SitemapRouteEntry[] = page.routes;
    const locales = getSitemapEntryLocales(pageId);
    const entries: (typeof SitemapPageUrl.Type)[] = [];

    for (const route of routes) {
      entries.push(
        ...getEntries(route.path, {
          ...(route.lastModified === undefined
            ? {}
            : { lastModified: route.lastModified }),
          locales,
        })
      );
    }

    return entries;
  }
);

/** Selects all locales for base pages and one locale for content pages. */
function getSitemapEntryLocales(pageId: string) {
  const descriptor = getSitemapPageDescriptor(pageId);

  if (descriptor && "kind" in descriptor) {
    return [descriptor.locale];
  }

  return routing.locales;
}

/** Reads one bounded sitemap page inside the sitemap origin cache.
 *
 * The cache key is the page id, which already encodes family, locale, and
 * partition. Entries keep the long built-in profile on purpose because only
 * publication purges them through the shared sitemap tag. The outcome is
 * built through `SitemapPageRead`, so only plain, serializable data is
 * cached. */
async function readCachedSitemapEntries(
  options: SitemapPageEntryOptions
): Promise<typeof SitemapPageRead.Type> {
  "use cache";

  applySitemapCache();
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
