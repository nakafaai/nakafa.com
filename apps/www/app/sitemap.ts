import { getContentMetadata } from "@repo/contents/_lib/content";
import { getFolderChildNames } from "@repo/contents/_lib/fs";
import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { askSeo } from "@repo/seo/ask";
import { Effect } from "effect";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";

// Main domain host
const host = `https://${MAIN_DOMAIN}`;

// Main domain for sitemap generation

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

// Constants for date calculations
const MONTHS_IN_FALLBACK_PERIOD = 6;
const MONTHS_IN_CONTENT_FALLBACK = 3;

// Constants for LLM route processing
const LLM_EXTENSION_PATTERN = /\.(mdx?|txt)$/;
const LLM_TXT_PATTERN = /\/llms\.txt$/;
const LLM_ROUTE_PRIORITY_MULTIPLIER = 0.8;

/**
 * Get actual last modified date for content based on metadata date
 */
async function getContentLastModified(
  contentPath: string,
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
      // Parse the metadata date (format: MM/DD/YYYY)
      const [month, day, year] = metadata.date.split("/");
      const metadataDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
      if (metadataDate.getTime() > 0) {
        return metadataDate;
      }
    }
  } catch {
    // If content doesn't exist or parsing fails, use fallback
  }

  // Return a reasonable default (6 months ago)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - MONTHS_IN_FALLBACK_PERIOD);
  return sixMonthsAgo;
}

/**
 * Determine appropriate change frequency and priority based on content type and path
 */
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
  // Homepage gets highest priority and monthly updates
  if (route === "/") {
    return { changeFrequency: "monthly", priority: 1.0 };
  }

  // Search and utility pages get medium priority and weekly updates
  if (baseRoutes.includes(route)) {
    return { changeFrequency: "weekly", priority: 0.8 };
  }

  // Quran pages are static content, rarely change
  if (route.startsWith("/quran")) {
    return { changeFrequency: "yearly", priority: 0.6 };
  }

  // OG images never change once generated
  if (route.includes("/og/") && route.endsWith("/image.png")) {
    return { changeFrequency: "never", priority: 0.1 };
  }

  // Educational content by level
  if (route.includes("/university/")) {
    return { changeFrequency: "monthly", priority: 0.9 }; // University content is high priority
  }

  if (route.includes("/high-school/")) {
    return { changeFrequency: "monthly", priority: 0.8 }; // High school content
  }

  if (route.includes("/middle-school/")) {
    return { changeFrequency: "monthly", priority: 0.7 }; // Middle school content
  }

  if (route.includes("/elementary-school/")) {
    return { changeFrequency: "monthly", priority: 0.6 }; // Elementary content
  }

  // Default for other content
  return { changeFrequency: "monthly", priority: 0.5 };
}

export function getQuranRoutes(): string[] {
  return Array.from({ length: 114 }, (_, index) => `/quran/${index + 1}`);
}

export function getAskRoutes(): string[] {
  return askSeo().map((data) => `/ask/${data.slug}`);
}

// Generate LLM-friendly routes by adding .md, .mdx, .txt, and /llms.txt extensions
export function getLlmRoutes(routes: string[]): string[] {
  const llmRoutes: string[] = [];

  for (const route of routes) {
    // For homepage, handle specially to avoid double slashes
    if (route === "/") {
      llmRoutes.push("/.md");
      llmRoutes.push("/.mdx");
      llmRoutes.push("/.txt");
      llmRoutes.push("/llms.txt");
    } else {
      // For other routes, add extensions normally
      llmRoutes.push(`${route}.md`);
      llmRoutes.push(`${route}.mdx`);
      llmRoutes.push(`${route}.txt`);
      llmRoutes.push(`${route}/llms.txt`);
    }
  }

  return llmRoutes;
}

// Function to recursively get all directories
export function getContentRoutes(currentPath = ""): string[] {
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

type Href = Parameters<typeof getPathname>[number]["href"];

export async function getEntries(
  href: Href,
  domain?: string
): Promise<MetadataRoute.Sitemap> {
  // Handle both string and object href types
  const routeString = typeof href === "string" ? href : href.pathname;
  const { changeFrequency, priority } = getContentSeoSettings(routeString);

  // For content routes, try to get actual modification date
  let lastModified = new Date(); // fallback to current date

  if (
    routeString !== "/" &&
    !baseRoutes.includes(routeString) &&
    !routeString.includes("/og/") &&
    !routeString.startsWith("/quran")
  ) {
    try {
      // This is likely educational content, get actual modification date
      const contentPath = routeString.startsWith("/")
        ? routeString.substring(1)
        : routeString;
      lastModified = await getContentLastModified(contentPath);
    } catch {
      // If we can't get the actual date, use a reasonable fallback
      // Educational content typically doesn't change very frequently
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(
        threeMonthsAgo.getMonth() - MONTHS_IN_CONTENT_FALLBACK
      );
      lastModified = threeMonthsAgo;
    }
  } else if (routeString.startsWith("/quran")) {
    // Quran content is very stable, set to founding date
    lastModified = new Date("2025-01-01");
  } else if (routeString.includes("/og/")) {
    // OG images, set to a reasonable date after founding
    lastModified = new Date("2025-01-01");
  } else if (routeString.startsWith("/ask/")) {
    // Ask content is very stable, set to founding date
    lastModified = new Date("2025-01-01");
  } else if (routeString.startsWith("/about")) {
    // About page is very stable, set to founding date
    lastModified = new Date("2025-01-01");
  } else if (routeString.startsWith("/contributor")) {
    // Contributor page is very stable, set to founding date
    lastModified = new Date("2025-01-01");
  }

  return routing.locales.map((locale) => ({
    url: getUrl(href, locale, domain),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((cur) => [cur, getUrl(href, cur, domain)])
      ),
    },
    changeFrequency,
    lastModified,
    priority,
  }));
}

export function getUrl(href: Href, locale: Locale, domain?: string): string {
  const pathname = getPathname({ locale, href, forcePrefix: true });
  const domainHost = domain ? `https://${domain}` : host;
  return domainHost + pathname;
}

// Generate sitemap entries for LLM routes without locale prefix (main domain only)
export async function getLlmEntries(
  href: Href,
  domain?: string
): Promise<MetadataRoute.Sitemap> {
  const routeString = typeof href === "string" ? href : href.pathname;
  const { changeFrequency, priority } = getContentSeoSettings(routeString);

  // For LLM routes, use a reasonable default date
  let lastModified = new Date("2025-01-01");

  // Try to get actual modification date for content routes
  if (
    routeString !== "/" &&
    !baseRoutes.includes(routeString) &&
    !routeString.includes("/og/") &&
    !routeString.startsWith("/quran") &&
    !routeString.startsWith("/ask/")
  ) {
    try {
      const contentPath = routeString.startsWith("/")
        ? routeString.substring(1)
        : routeString;
      // Remove LLM extensions to get actual content path
      const cleanPath = contentPath
        .replace(LLM_EXTENSION_PATTERN, "")
        .replace(LLM_TXT_PATTERN, "");
      lastModified = await getContentLastModified(cleanPath);
    } catch {
      lastModified = new Date("2025-01-01");
    }
  }

  const domainHost = domain ? `https://${domain}` : host;
  const url = `${domainHost}${routeString}`;

  return [
    {
      url,
      changeFrequency,
      lastModified,
      priority: priority * LLM_ROUTE_PRIORITY_MULTIPLIER, // Slightly lower priority for LLM routes
    },
  ];
}

// Return OG routes based on regular routes
export function getOgRoutes(routes: string[]): string[] {
  return routes.flatMap((route) => {
    if (route === "/") {
      return ["/og/image.png"];
    }
    return [`/og${route}`, `/og${route}/image.png`];
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const contentRoutes = getContentRoutes(); // Get routes from 'contents' directory
  const ogRoutes = getOgRoutes(contentRoutes);
  const quranRoutes = getQuranRoutes();
  const askRoutes = getAskRoutes();

  // Deduplicate all base routes (contentRoutes might include "/" which is also in baseRoutes)
  const allBaseRoutesSet = new Set([
    ...baseRoutes,
    ...contentRoutes,
    ...quranRoutes,
    ...askRoutes,
  ]);
  const allBaseRoutes = Array.from(allBaseRoutesSet);

  // Generate LLM-friendly routes for AI/LLM accessibility
  const llmRoutes = getLlmRoutes(allBaseRoutes);

  // Regular routes including OG images
  const regularRoutesSet = new Set([...allBaseRoutes, ...ogRoutes]);
  const regularRoutes = Array.from(regularRoutesSet);

  // Generate sitemap entries for regular routes (with locale prefixes)
  const regularWithLocalePromises = regularRoutes.map(
    async (route) => await getEntries(route, MAIN_DOMAIN)
  );

  // Generate sitemap entries for regular routes (without locale prefixes)
  const regularWithoutLocalePromises = allBaseRoutes.map(
    async (route) => await getLlmEntries(route, MAIN_DOMAIN)
  );

  // Generate sitemap entries for LLM routes (with locale prefixes)
  const llmWithLocalePromises = llmRoutes.map(
    async (route) => await getEntries(route, MAIN_DOMAIN)
  );

  // Generate sitemap entries for LLM routes (without locale prefixes)
  const llmWithoutLocalePromises = llmRoutes.map(
    async (route) => await getLlmEntries(route, MAIN_DOMAIN)
  );

  const [
    regularWithLocaleArrays,
    regularWithoutLocaleArrays,
    llmWithLocaleArrays,
    llmWithoutLocaleArrays,
  ] = await Promise.all([
    Promise.all(regularWithLocalePromises),
    Promise.all(regularWithoutLocalePromises),
    Promise.all(llmWithLocalePromises),
    Promise.all(llmWithoutLocalePromises),
  ]);

  const allEntries = [
    ...regularWithLocaleArrays.flat(),
    ...regularWithoutLocaleArrays.flat(),
    ...llmWithLocaleArrays.flat(),
    ...llmWithoutLocaleArrays.flat(),
  ];

  // Deduplicate final URLs to ensure no duplicates in sitemap
  const uniqueUrlsMap = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of allEntries) {
    if (!uniqueUrlsMap.has(entry.url)) {
      uniqueUrlsMap.set(entry.url, entry);
    }
  }

  return Array.from(uniqueUrlsMap.values());
}
