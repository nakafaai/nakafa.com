import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { publicInternalHref } from "@repo/internationalization/src/href";
import { LOCALES } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

/** One canonical sitemap URL, with its optional date as text. */
const SitemapPageUrl = Schema.Struct({
  lastModified: Schema.optionalKey(Schema.String),
  url: Schema.String,
});

/** Optional settings of one route's canonical sitemap entries. */
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
export function getSitemapEntryLocales(pageId: string) {
  return Option.match(getSitemapPageDescriptor(pageId), {
    onNone: () => LOCALES,
    onSome: (descriptor) =>
      "kind" in descriptor ? [descriptor.locale] : LOCALES,
  });
}
