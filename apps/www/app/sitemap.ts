import { getContent, getFolderChildNames } from "@repo/contents/_lib/utils";
import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { askSeo } from "@repo/seo/ask";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";

// Main domain host
const host = `https://${MAIN_DOMAIN}`;

// Main domain for sitemap generation

export const baseRoutes = [
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

/**
 * Get actual last modified date for content based on metadata date
 */
async function getContentLastModified(
  contentPath: string,
  locale: Locale = "en"
): Promise<Date> {
  try {
    const content = await getContent(locale, contentPath);
    if (content?.metadata.date) {
      // Parse the metadata date (format: MM/DD/YYYY)
      const [month, day, year] = content.metadata.date.split("/");
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

// Generate LLM-friendly routes by adding .md, .mdx, and /llms.txt extensions
export function getLlmRoutes(routes: string[]): string[] {
  const llmExtensions = [".md", ".mdx", "/llms.txt"];
  const llmRoutes: string[] = [];

  for (const route of routes) {
    for (const ext of llmExtensions) {
      llmRoutes.push(`${route}${ext}`);
    }
  }

  return llmRoutes;
}

// Function to recursively get all directories
export function getContentRoutes(currentPath = ""): string[] {
  const children = getFolderChildNames(currentPath || ".");

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

// Return OG routes based on regular routes
export function getOgRoutes(routes: string[]): string[] {
  return routes.map((route) => {
    if (route === "/") {
      return "/og/image.png";
    }
    return `/og${route}/image.png`;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const contentRoutes = getContentRoutes(); // Get routes from 'contents' directory
  const ogRoutes = getOgRoutes(contentRoutes);
  const quranRoutes = getQuranRoutes();
  const askRoutes = getAskRoutes();

  // Generate LLM-friendly routes for AI/LLM accessibility
  const llmRoutes = getLlmRoutes([
    ...baseRoutes,
    ...contentRoutes,
    ...quranRoutes,
    ...askRoutes,
  ]);

  const allBaseRoutes = [
    ...baseRoutes,
    ...contentRoutes,
    ...ogRoutes,
    ...quranRoutes,
    ...askRoutes,
    ...llmRoutes,
  ];

  // Generate sitemap entries only for main domain
  const sitemapEntriesPromises = allBaseRoutes.map(
    async (route) => await getEntries(route, MAIN_DOMAIN)
  );

  const sitemapEntriesArrays = await Promise.all(sitemapEntriesPromises);
  const sitemapEntries = sitemapEntriesArrays.flat();

  // Add homepage entry for main domain
  const homeEntries = await getEntries("/", MAIN_DOMAIN);

  return [...homeEntries, ...sitemapEntries];
}
