import { getFolderChildNames } from "@repo/contents/_lib/utils";
import { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";

// Adapt this as necessary
const host = "https://nakafa.com";

export const baseRoutes = ["/search", "/contributor"];

// Function to recursively get all directories
export function getAllRoutes(basePath = "", currentPath = ""): string[] {
  const children = getFolderChildNames(currentPath || ".");

  let routes = currentPath ? [`/${currentPath.replace(/\\/g, "/")}`] : ["/"];

  for (const child of children) {
    const childPath = currentPath ? `${currentPath}/${child}` : child;
    const childRoutes = getAllRoutes(basePath, childPath);
    routes = [...routes, ...childRoutes];
  }

  return routes;
}

type Href = Parameters<typeof getPathname>[number]["href"];

export function getEntries(href: Href): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: getUrl(href, locale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((cur) => [cur, getUrl(href, cur)])
      ),
    },
    changeFrequency: "weekly",
    lastModified: new Date(),
    priority: 1,
  }));
}

export function getUrl(href: Href, locale: Locale): string {
  const pathname = getPathname({ locale, href });
  return host + pathname;
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

export default function sitemap(): MetadataRoute.Sitemap {
  const contentRoutes = getAllRoutes(); // Get routes from 'contents' directory
  const ogRoutes = getOgRoutes(contentRoutes);
  const allBaseRoutes = [...baseRoutes, ...contentRoutes, ...ogRoutes];

  // Generate sitemap entries for all routes, including localized versions
  const sitemapEntries = allBaseRoutes.flatMap((route) => {
    // The getEntries function already creates entries for all locales
    return getEntries(route as Href);
  });

  // Add the main homepage entry separately if not covered by getAllRoutes("/")
  const homeEntry: MetadataRoute.Sitemap = [
    {
      url: host,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((cur) => [cur, getUrl("/" as Href, cur)])
        ),
      },
    },
  ];

  // You might want to filter out duplicates if getAllRoutes can return "/"
  // and also handle OG routes if they should be in the sitemap explicitly.
  // For now, this focuses on content page discoverability.

  return [...homeEntry, ...sitemapEntries].filter(
    (entry, index, self) => index === self.findIndex((e) => e.url === entry.url)
  ); // Basic deduplication
}
