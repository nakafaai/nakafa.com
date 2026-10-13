import { HashSet } from "effect";

/**
 * The first path segments that concrete application routes own. The public
 * route surfaces own their localized namespaces beside these. A signed Page
 * cannot take one of these roots, and no username can be one.
 */
export const APPLICATION_ROUTE_ROOTS = HashSet.make(
  "articles",
  "auth",
  "chat",
  "contributor",
  "home",
  "og",
  "onboarding",
  "pricing",
  "quran",
  "school",
  "search",
  "user"
);
