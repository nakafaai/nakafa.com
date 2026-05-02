import { isYearlessTryOutCollectionSlug } from "@repo/contents/_lib/exercises/slug";
import { getFolderChildNames } from "@repo/contents/_lib/fs";
import { getContentMetadata } from "@repo/contents/_lib/metadata";
import { parseContentDate } from "@repo/contents/_shared/date";
import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect } from "effect";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";

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
const EXERCISE_ROUTE_PREFIX_LEN = 4;

/** Static top-level routes that should always be present in the sitemap. */
export const baseRoutes = [
  "/",
  "/search",
  "/contributor",
  "/quran",
  "/about",
  "/terms-of-service",
  "/privacy-policy",
  "/security-policy",
];

/** Builds relative Quran routes from `/quran/1` through `/quran/114`. */
export function getQuranRoutes() {
  return Array.from({ length: 114 }, (_, index) => `/quran/${index + 1}`);
}

/**
 * Walks the content package tree and converts indexable folders into relative
 * route paths.
 */
export function getContentRoutes(currentPath = "") {
  const children = Effect.runSync(
    Effect.match(getFolderChildNames(currentPath || "."), {
      onFailure: () => [],
      onSuccess: (data) => data,
    })
  );

  let routes = currentPath ? [`/${currentPath.replace(/\\/g, "/")}`] : ["/"];

  for (const child of children) {
    const childPath = currentPath ? `${currentPath}/${child}` : child;
    const childRoutes = getContentRoutes(childPath);
    routes = [...routes, ...childRoutes];
  }

  return routes;
}

/** Builds the deduplicated route list used by `/sitemap.xml` and indexing scripts. */
export function getSitemapRoutes() {
  const contentRoutes = getContentRoutes().filter(isIndexableContentRoute);
  const allRoutes = new Set([
    ...baseRoutes,
    ...contentRoutes,
    ...getQuranRoutes(),
  ]);

  return Array.from(allRoutes);
}

/**
 * Expands one route into localized sitemap entries with alternate language
 * URLs, last-modified metadata, change frequency, and priority.
 */
export async function getEntries(
  href: Href,
  optionsOrDomain: SitemapEntryOptions | string = {}
): Promise<MetadataRoute.Sitemap> {
  const options = normalizeSitemapOptions(optionsOrDomain);
  const routeString = typeof href === "string" ? href : href.pathname;
  const { changeFrequency, priority } = getContentSeoSettings(routeString);
  let lastModified = new Date();

  if (isContentRoute(routeString)) {
    try {
      const contentPath = routeString.startsWith("/")
        ? routeString.slice(1)
        : routeString;
      lastModified = await getContentLastModified(contentPath, options);
    } catch (error) {
      await reportError(error, options, {
        route: routeString,
        source: "sitemap-route-entry",
      });

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(
        threeMonthsAgo.getMonth() - MONTHS_IN_CONTENT_FALLBACK
      );
      lastModified = threeMonthsAgo;
    }
  } else if (routeString.startsWith("/quran")) {
    lastModified = new Date("2025-01-01");
  } else if (routeString.startsWith("/about")) {
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
}

/** Converts an app href and locale into an absolute canonical URL. */
export function getUrl(href: Href, locale: Locale, domain?: string): string {
  const pathname = getPathname({ locale, href, forcePrefix: true });
  const domainHost = domain ? `https://${domain}` : host;
  return domainHost + pathname;
}

/** Generates sitemap entries ready for Next metadata output or URL submission. */
export async function getSitemapEntries(
  options: SitemapEntryOptions = {}
): Promise<MetadataRoute.Sitemap> {
  const routePromises = getSitemapRoutes().map((route) =>
    getEntries(route, options)
  );
  const routeArrays = await Promise.all(routePromises);
  const allEntries = routeArrays.flat();
  const uniqueUrls = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const entry of allEntries) {
    if (uniqueUrls.has(entry.url)) {
      continue;
    }

    uniqueUrls.set(entry.url, entry);
  }

  return Array.from(uniqueUrls.values());
}

/**
 * Resolves the last-modified date for content from localized MDX metadata.
 * Falls back to a stable date when metadata is missing or invalid.
 */
async function getContentLastModified(
  contentPath: string,
  options: SitemapEntryOptions,
  locale: Locale = "en"
): Promise<Date> {
  try {
    const metadata = await Effect.runPromise(
      Effect.match(getContentMetadata(contentPath, locale), {
        onFailure: () => null,
        onSuccess: (data) => data,
      })
    );

    if (metadata?.date) {
      const metadataDate = parseContentDate(metadata.date);

      if (metadataDate && metadataDate.getTime() > 0) {
        return metadataDate;
      }
    }
  } catch (error) {
    await reportError(error, options, {
      content_path: contentPath,
      locale,
      source: "sitemap-content-last-modified",
    });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - MONTHS_IN_FALLBACK_PERIOD);
  return sixMonthsAgo;
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

/** Filters raw content folder routes down to routes that represent real pages. */
function isIndexableContentRoute(route: string) {
  const routeSegments = route.split("/").filter(Boolean);
  const [routeBase, category, type, material] = routeSegments;
  const isExerciseRoute =
    routeBase === "exercises" &&
    category !== undefined &&
    type !== undefined &&
    material !== undefined;

  if (!isExerciseRoute) {
    return true;
  }

  const exerciseSlugFromRoute = routeSegments.slice(EXERCISE_ROUTE_PREFIX_LEN);
  return !isYearlessTryOutCollectionSlug(exerciseSlugFromRoute);
}

/** Sends a non-fatal sitemap generation error to the optional reporter. */
async function reportError(
  error: unknown,
  options: SitemapEntryOptions,
  context: SitemapErrorContext
) {
  if (!options.reportError) {
    return;
  }

  await options.reportError(error, context);
}

/** Normalizes the current options object and the older direct-domain call shape. */
function normalizeSitemapOptions(
  optionsOrDomain: SitemapEntryOptions | string
): SitemapEntryOptions {
  if (typeof optionsOrDomain === "string") {
    return { domain: optionsOrDomain };
  }

  return optionsOrDomain;
}
