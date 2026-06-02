import { getContentMetadata } from "@repo/contents/_lib/metadata";
import { parseContentDate } from "@repo/contents/_shared/date";
import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { baseRoutes, getSitemapRoutes } from "@/lib/sitemap/routes";

type Href = Parameters<typeof getPathname>[number]["href"];
type SitemapErrorContext = Record<string, string>;
type SitemapErrorReporter = (
  error: unknown,
  context: SitemapErrorContext
) => Promise<void>;

/** Optional settings shared by the Next route and standalone indexing scripts. */
interface SitemapEntryOptions {
  domain?: string;
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
  const { changeFrequency, priority } = getContentSeoSettings(routeString);
  let lastModified = new Date();

  if (isContentRoute(routeString)) {
    const contentPath = routeString.startsWith("/")
      ? routeString.slice(1)
      : routeString;
    lastModified = yield* getContentLastModified(contentPath, options).pipe(
      Effect.catchAll((error) =>
        reportError(error, options, {
          route: routeString,
          source: "sitemap-route-entry",
        }).pipe(Effect.as(getFallbackDate(MONTHS_IN_CONTENT_FALLBACK)))
      )
    );
  } else if (routeString === "/") {
    lastModified = new Date("2025-01-01");
  } else if (routeString.startsWith("/quran")) {
    lastModified = new Date("2025-01-01");
  } else if (routeString.startsWith("/contributor")) {
    lastModified = new Date("2025-01-01");
  }

  return routing.locales.map((locale) => ({
    url: getUrl(href, locale, options.domain),
    alternates: {
      languages: {
        ...Object.fromEntries(
          routing.locales.map((cur) => [cur, getUrl(href, cur, options.domain)])
        ),
        "x-default": getUrl(href, "en", options.domain),
      },
    },
    changeFrequency,
    lastModified,
    priority,
  }));
});

/** Converts an app href and locale into an absolute canonical URL. */
export function getUrl(href: Href, locale: Locale, domain?: string): string {
  const pathname = getPathname({ locale, href, forcePrefix: true });
  const domainHost = domain ? `https://${domain}` : host;

  return domainHost + pathname;
}

/** Generates sitemap entries ready for Next metadata output or URL submission. */
export const getSitemapEntries = Effect.fn("www.sitemap.entries.all")(
  function* (options: SitemapEntryOptions = {}) {
    const routes = yield* Effect.promise(() => getSitemapRoutes());
    const routeArrays = yield* Effect.forEach(
      routes,
      (route) => getEntries(route, options),
      {
        concurrency: "unbounded",
      }
    );

    return routeArrays.flat();
  }
);

/**
 * Resolves the last-modified date for content from localized MDX metadata.
 * Falls back to a stable date when metadata is missing or invalid.
 */
const getContentLastModified = Effect.fn("www.sitemap.contentLastModified")(
  function* (
    contentPath: string,
    options: SitemapEntryOptions,
    locale: Locale = "en"
  ) {
    const metadata = yield* Effect.try({
      try: () => getContentMetadata(contentPath, locale),
      catch: (error) => error,
    }).pipe(
      Effect.flatMap((metadataEffect) =>
        Effect.match(metadataEffect, {
          onFailure: () => null,
          onSuccess: (data) => data,
        })
      ),
      Effect.catchAll((error) =>
        reportError(error, options, {
          content_path: contentPath,
          locale,
          source: "sitemap-content-last-modified",
        }).pipe(Effect.as(null))
      )
    );

    if (metadata?.date) {
      const metadataDate = parseContentDate(metadata.date);

      if (Option.isSome(metadataDate) && metadataDate.value.getTime() > 0) {
        return metadataDate.value;
      }
    }

    return getFallbackDate(MONTHS_IN_FALLBACK_PERIOD);
  }
);

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

  if (route.includes("/university/")) {
    return { changeFrequency: "monthly", priority: 0.9 };
  }

  if (route.includes("/high-school/")) {
    return { changeFrequency: "monthly", priority: 0.8 };
  }

  if (route.includes("/middle-school/")) {
    return { changeFrequency: "monthly", priority: 0.7 };
  }

  if (route.includes("/elementary-school/")) {
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
