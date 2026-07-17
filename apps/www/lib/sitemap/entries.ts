import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect } from "effect";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import {
  baseRoutes,
  getSitemapPageDescriptor,
  readSitemapRoutePage,
} from "@/lib/sitemap/routes";

type SitemapEntry = MetadataRoute.Sitemap[number];
type SitemapChangeFrequency = NonNullable<SitemapEntry["changeFrequency"]>;

/** Optional settings shared by the Next route and standalone indexing scripts. */
interface SitemapEntryOptions {
  lastModified?: number;
  locales: readonly Locale[];
}

interface SitemapPageEntryOptions {
  pageId: string;
}

const host = `https://${MAIN_DOMAIN}`;

const MONTHS_IN_CONTENT_FALLBACK = 3;

/**
 * Expands one route into localized sitemap entries with alternate language
 * URLs, last-modified metadata, change frequency, and priority.
 */
function getEntries(href: string, options: SitemapEntryOptions) {
  const routeString = href;
  const locales = options.locales;
  const { changeFrequency, priority } = getContentSeoSettings(routeString);

  return locales.map((locale) => ({
    url: getUrl(href, locale),
    alternates: {
      languages: getAlternateLanguages(href, locales),
    },
    changeFrequency,
    lastModified: getRouteLastModified(routeString, options.lastModified),
    priority,
  }));
}

/** Resolves the best already-known sitemap modification date. */
function getRouteLastModified(routeString: string, lastModified?: number) {
  if (
    lastModified !== undefined &&
    Number.isFinite(lastModified) &&
    lastModified > 0
  ) {
    return new Date(lastModified);
  }

  if (isContentRoute(routeString)) {
    return getFallbackDate(MONTHS_IN_CONTENT_FALLBACK);
  }

  if (
    routeString === "/" ||
    routeString.startsWith("/quran") ||
    routeString.startsWith("/contributor")
  ) {
    return new Date("2025-01-01");
  }

  return new Date();
}

/** Builds hreflang alternates only for locales included in the current page. */
function getAlternateLanguages(href: string, locales: readonly Locale[]) {
  const languages: Partial<{ [Key in Locale | "x-default"]: string }> = {};

  for (const locale of locales) {
    languages[locale] = getUrl(href, locale);
  }

  if (locales.includes(routing.defaultLocale)) {
    languages["x-default"] = getUrl(href, routing.defaultLocale);
  }

  return languages;
}

/** Converts an app href and locale into an absolute canonical URL. */
function getUrl(href: string, locale: Locale): string {
  const mappedPathname = getLocalizedMappedRoutePathname({
    locale,
    route: href,
  });

  if (mappedPathname) {
    return `${host}/${locale}${mappedPathname}`;
  }

  return host + getPathname({ locale, href, forcePrefix: true });
}

/** Generates entries for one bounded sitemap page. */
export const getSitemapEntries = Effect.fn("www.sitemap.entries.page")(
  function* (options: SitemapPageEntryOptions) {
    const pageId = options.pageId;
    const page = yield* readSitemapRoutePage(pageId);
    const locales = getSitemapEntryLocales(pageId);
    const entries: SitemapEntry[] = [];

    for (const route of page.routes) {
      entries.push(
        ...getEntries(route.path, {
          ...options,
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

/** Builds a stable relative recovery date for sitemap rows without source dates. */
function getFallbackDate(monthsAgo: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date;
}

/** Chooses sitemap change frequency and priority from the route family. */
function getContentSeoSettings(route: string): {
  changeFrequency: SitemapChangeFrequency;
  priority: number;
} {
  if (route === "/") {
    return { changeFrequency: "monthly", priority: 1.0 };
  }

  if (baseRoutes.includes(route)) {
    return { changeFrequency: "weekly", priority: 0.8 };
  }

  if (route.startsWith("/quran")) {
    return { changeFrequency: "yearly", priority: 0.6 };
  }

  if (route.startsWith("/subjects/") || route.startsWith("/materi/")) {
    return { changeFrequency: "monthly", priority: 0.8 };
  }

  if (route.startsWith("/curriculum/") || route.startsWith("/kurikulum/")) {
    return { changeFrequency: "monthly", priority: 0.7 };
  }

  if (route.startsWith("/try-out/")) {
    return { changeFrequency: "monthly", priority: 0.6 };
  }

  return { changeFrequency: "monthly", priority: 0.5 };
}

/** Checks whether a route should use content metadata for `lastModified`. */
function isContentRoute(route: string) {
  return (
    route !== "/" && !baseRoutes.includes(route) && !route.startsWith("/quran")
  );
}
