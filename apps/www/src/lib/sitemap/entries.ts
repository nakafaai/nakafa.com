import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { publicInternalHref } from "@repo/internationalization/src/href";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import {
  getSitemapPageDescriptor,
  SITEMAP_BASE_ID,
} from "@/lib/sitemap/identity";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

/** One `hreflang` alternate of a sitemap URL: the address of the same route in one locale. */
const SitemapAlternate = Schema.Struct({
  hreflang: Schema.String,
  href: Schema.String,
});

/** One canonical sitemap URL, with its alternates and its optional date as text. */
const SitemapPageUrl = Schema.Struct({
  alternates: Schema.optionalKey(Schema.Array(SitemapAlternate)),
  lastModified: Schema.optionalKey(Schema.String),
  url: Schema.String,
});

/** Optional settings of one route's canonical sitemap entries. */
const SitemapEntryOptions = Schema.Struct({
  /** Whether the route is a base route, which exists in every locale and so names its alternates. */
  alternates: Schema.Boolean,
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
  const alternates = options.alternates
    ? getAlternates(href, options.locales)
    : undefined;
  return Arr.map(options.locales, (locale) => ({
    ...(alternates === undefined ? {} : { alternates }),
    ...(options.lastModified === undefined
      ? {}
      : { lastModified: options.lastModified }),
    url: getUrl(href, locale),
  }));
}

/**
 * Names the route in each locale it is listed in, and x-default at the default
 * locale's address, as the page head does. Only a base route takes this path: a
 * content page exists in one locale, so its alternates stay in its head.
 */
function getAlternates(href: string, locales: readonly Locale[]) {
  return [
    ...Arr.map(locales, (locale) => ({
      hreflang: locale,
      href: getUrl(href, locale),
    })),
    { hreflang: "x-default", href: getUrl(href, DEFAULT_LOCALE) },
  ];
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
          alternates: pageId === SITEMAP_BASE_ID,
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
