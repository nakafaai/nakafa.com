import { findPublicRouteByPath } from "@repo/contents/_types/route/projection";
import type {
  PublicContentRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { getRuntimeContentRoute } from "@/lib/content/runtime";
import {
  baseRoutes,
  type ContentSitemapPage,
  getSitemapPageDescriptor,
  readSitemapPageDescriptors,
  readSitemapRoutes,
} from "@/lib/sitemap/routes";

type Href = Parameters<typeof getPathname>[number]["href"];
type SitemapErrorContext = Readonly<{
  content_path?: string;
  locale?: Locale;
  route?: string;
  source: string;
}>;
type SitemapErrorReporter = (
  error: unknown,
  context: SitemapErrorContext
) => Promise<void>;

/** Optional settings shared by the Next route and standalone indexing scripts. */
interface SitemapEntryOptions {
  domain?: string;
  locales?: readonly Locale[];
  pageId?: string;
  reportError?: SitemapErrorReporter;
}

const host = `https://${MAIN_DOMAIN}`;

const MONTHS_IN_FALLBACK_PERIOD = 6;
const MONTHS_IN_CONTENT_FALLBACK = 3;

/**
 * Expands one route into localized sitemap entries with alternate language
 * URLs, last-modified metadata, change frequency, and priority.
 */
export const getEntries = Effect.fn("www.sitemap.entries")(function* (
  href: Href,
  options: SitemapEntryOptions = {}
) {
  const routeString = typeof href === "string" ? href : href.pathname;
  const locales = options.locales ?? routing.locales;
  const { changeFrequency, priority } = getContentSeoSettings(routeString);

  return yield* Effect.forEach(
    locales,
    (locale) =>
      Effect.gen(function* () {
        const lastModified = yield* getRouteLastModified(
          routeString,
          locale,
          options
        );

        return {
          url: getUrl(href, locale, options.domain),
          alternates: {
            languages: getAlternateLanguages(href, locales, options.domain),
          },
          changeFrequency,
          lastModified,
          priority,
        };
      }),
    {
      concurrency: "unbounded",
    }
  );
});

/** Resolves the sitemap last-modified value for one route and locale. */
const getRouteLastModified = Effect.fn("www.sitemap.routeLastModified")(
  function* (
    routeString: string,
    locale: Locale,
    options: SitemapEntryOptions
  ) {
    if (isContentRoute(routeString)) {
      const contentPath = routeString.startsWith("/")
        ? routeString.slice(1)
        : routeString;

      return yield* getContentLastModified(contentPath, options, locale).pipe(
        Effect.catchAll((error) =>
          reportError(error, options, {
            route: routeString,
            source: "sitemap-route-entry",
          }).pipe(Effect.as(getFallbackDate(MONTHS_IN_CONTENT_FALLBACK)))
        )
      );
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
);

/** Builds hreflang alternates only for locales included in the current page. */
function getAlternateLanguages(
  href: Href,
  locales: readonly Locale[],
  domain: string | undefined
) {
  const languages: Partial<{ [Key in Locale | "x-default"]: string }> = {};

  for (const locale of locales) {
    languages[locale] = getUrl(href, locale, domain);
  }

  if (locales.includes(routing.defaultLocale)) {
    languages["x-default"] = getUrl(href, routing.defaultLocale, domain);
  }

  return languages;
}

/** Converts an app href and locale into an absolute canonical URL. */
export function getUrl(href: Href, locale: Locale, domain?: string): string {
  const pathname = getPathname({ locale, href, forcePrefix: true });
  const domainHost = domain ? `https://${domain}` : host;

  return domainHost + pathname;
}

/** Generates sitemap entries ready for Next metadata output or URL submission. */
export const getSitemapEntries = Effect.fn("www.sitemap.entries.all")(
  function* (options: SitemapEntryOptions = {}) {
    if (options.pageId !== undefined) {
      return yield* getSitemapPageEntries(options);
    }

    const descriptors = yield* readSitemapPageDescriptors();
    const pageEntries = yield* Effect.forEach(
      descriptors,
      (descriptor) =>
        getSitemapPageEntries({
          ...options,
          pageId: descriptor.id,
        }),
      {
        concurrency: "unbounded",
      }
    );

    return pageEntries.flat();
  }
);

/** Generates entries for one bounded sitemap page. */
const getSitemapPageEntries = Effect.fn("www.sitemap.entries.page")(function* (
  options: SitemapEntryOptions
) {
  const pageId = options.pageId;
  const routes = yield* readSitemapRoutes(pageId);
  const locales = getSitemapEntryLocales(pageId);
  const routeArrays = yield* Effect.forEach(
    routes,
    (route) =>
      getEntries(route, {
        ...options,
        locales,
      }),
    {
      concurrency: "unbounded",
    }
  );

  return routeArrays.flat();
});

/** Selects all locales for base pages and one locale for content pages. */
function getSitemapEntryLocales(pageId: string | undefined): readonly Locale[] {
  const descriptor = getSitemapPageDescriptor(pageId);

  if (isContentSitemapDescriptor(descriptor)) {
    return [descriptor.locale];
  }

  return routing.locales;
}

/** Identifies parsed sitemap descriptors that are scoped to one locale. */
function isContentSitemapDescriptor(
  descriptor: ReturnType<typeof getSitemapPageDescriptor>
): descriptor is ContentSitemapPage {
  return Boolean(descriptor && "locale" in descriptor);
}

/**
 * Resolves the last-modified date for content from the Convex route catalog.
 * Falls back to a stable date when metadata is missing or invalid.
 */
const getContentLastModified = Effect.fn("www.sitemap.contentLastModified")(
  function* (
    contentPath: string,
    options: SitemapEntryOptions,
    locale: Locale
  ) {
    const sourcePath = yield* getRuntimeContentLookupPath(contentPath, locale);
    const route = yield* getRuntimeContentRoute({
      locale,
      route: sourcePath,
    }).pipe(
      Effect.catchAll((error) =>
        reportError(error, options, {
          content_path: sourcePath,
          locale,
          source: "sitemap-content-last-modified",
        }).pipe(Effect.as(null))
      )
    );

    if (route?.date && route.date > 0) {
      return new Date(route.date);
    }

    return getFallbackDate(MONTHS_IN_FALLBACK_PERIOD);
  }
);

/** Converts a projected public path to the source route stored in Convex. */
const getRuntimeContentLookupPath = Effect.fn("www.sitemap.contentLookupPath")(
  function* (contentPath: string, locale: Locale) {
    const route = yield* findPublicRouteByPath(contentPath, locale);

    return Option.match(route, {
      onNone: () => contentPath,
      onSome: (publicRoute) => {
        if (isPublicContentRoute(publicRoute)) {
          return publicRoute.sourcePath;
        }

        return contentPath;
      },
    });
  }
);

/** Checks whether a projected public route has source-backed markdown content. */
function isPublicContentRoute(route: PublicRoute): route is PublicContentRoute {
  return (
    route.kind === "subject-topic" ||
    route.kind === "subject-lesson" ||
    route.kind === "exercise-set" ||
    route.kind === "exercise-question"
  );
}

/** Builds a stable relative fallback date for sitemap recovery paths. */
function getFallbackDate(monthsAgo: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date;
}

/** Chooses sitemap change frequency and priority from the route family. */
function getContentSeoSettings(route: string): {
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
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

  if (
    route.startsWith("/curriculum/") ||
    route.startsWith("/kurikulum/") ||
    route.startsWith("/exams/") ||
    route.startsWith("/ujian/")
  ) {
    return { changeFrequency: "monthly", priority: 0.7 };
  }

  if (route.startsWith("/practice/") || route.startsWith("/latihan/")) {
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

/** Sends a non-fatal sitemap generation error to the optional reporter. */
function reportError(
  error: unknown,
  options: SitemapEntryOptions,
  context: SitemapErrorContext
) {
  const reporter = options.reportError;

  if (!reporter) {
    return Effect.void;
  }

  return Effect.tryPromise({
    try: () => reporter(error, context),
    catch: (cause) => cause,
  });
}
