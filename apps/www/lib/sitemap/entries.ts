import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect, Option } from "effect";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

type SitemapEntry = MetadataRoute.Sitemap[number];

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
    const entries: SitemapEntry[] = [];

    for (const route of routes) {
      entries.push(
        ...getEntries(route.path, {
          lastModified: route.lastModified,
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
