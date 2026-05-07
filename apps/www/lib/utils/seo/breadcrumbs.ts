import { MAIN_DOMAIN } from "@repo/next-config/domains";
import type { Locale } from "next-intl";

const SITE_ORIGIN = `https://${MAIN_DOMAIN}`;

interface BreadcrumbEntry {
  name: string;
  path: string;
}

/** Normalizes an app path before joining it with the locale prefix. */
function normalizeBreadcrumbPath(path: string) {
  if (path === "" || path === "/") {
    return "";
  }

  if (path.startsWith("/")) {
    return path;
  }

  return `/${path}`;
}

/** Builds Schema.org ListItem entries for a visible page hierarchy. */
export function createBreadcrumbItems(
  locale: Locale,
  entries: BreadcrumbEntry[]
) {
  return entries.map((entry, index) => {
    const path = normalizeBreadcrumbPath(entry.path);

    return {
      "@type": "ListItem" as const,
      position: index + 1,
      name: entry.name,
      item: `${SITE_ORIGIN}/${locale}${path}`,
    };
  });
}
