import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { cleanSlug } from "@repo/utilities/helper";
import type { Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

const routeSeparatorPattern = /[/_-]+/g;

/** Converts path-like queries into the token form Convex search expects. */
export function getRouteSearchText(queryText: string) {
  return queryText.replace(routeSeparatorPattern, " ").trim();
}

/** Parses exact path searches without treating plain words as routes. */
export function getExactRouteQuery(
  locale: ContentSearchInput["locale"],
  queryText: string
) {
  const route = cleanSlug(queryText);
  const localePrefix = `${locale}/`;

  if (!route) {
    return null;
  }

  if (route.startsWith(localePrefix)) {
    return route.slice(localePrefix.length);
  }

  if (!route.includes("/")) {
    return null;
  }

  return route;
}
