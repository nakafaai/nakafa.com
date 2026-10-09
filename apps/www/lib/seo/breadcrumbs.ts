import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Array as Arr, Schema } from "effect";
import type { Locale } from "next-intl";

const SITE_ORIGIN = `https://${MAIN_DOMAIN}`;

const BreadcrumbEntrySchema = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
});
type BreadcrumbEntry = typeof BreadcrumbEntrySchema.Type;

/** Normalizes an app path before joining it with the locale prefix. */
function normalizeBreadcrumbPath(path: string, locale: Locale) {
  if (path === "" || path === "/") {
    return "";
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const localePrefix = `/${locale}`;

  if (normalizedPath === localePrefix) {
    return "";
  }

  if (normalizedPath.startsWith(`${localePrefix}/`)) {
    return normalizedPath.slice(localePrefix.length);
  }

  return normalizedPath;
}

/** Builds Schema.org ListItem entries for a visible page hierarchy. */
export function createBreadcrumbItems(
  locale: Locale,
  entries: BreadcrumbEntry[]
) {
  return Arr.map(entries, (entry, index) => {
    const path = normalizeBreadcrumbPath(entry.path, locale);

    return {
      "@type": "ListItem" as const,
      position: index + 1,
      name: entry.name,
      item: `${SITE_ORIGIN}/${locale}${path}`,
    };
  });
}
