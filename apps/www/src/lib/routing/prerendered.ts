import { HashSet } from "effect";

/**
 * The route templates whose pages the build prerenders as static assets. A link to
 * one of them is a document load: the browser fetches the prerendered page, and no
 * client loader or server function reads the public content on the way.
 */
const PRERENDERED_ROUTE_TEMPLATES = HashSet.fromIterable([
  "/$locale",
  "/$locale/$",
  "/$locale/articles",
  "/$locale/articles/$category",
  "/$locale/articles/$category/$slug",
  "/$locale/contributor",
  "/$locale/curricula",
  "/$locale/curricula/$curriculum/$",
  "/$locale/materials/$subject/$topic/$",
  "/$locale/pricing",
  "/$locale/quran",
  "/$locale/quran/$surah",
  "/$locale/try-out",
  "/$locale/try-out/$country",
  "/$locale/try-out/$country/$exam",
  "/$locale/try-out/$country/$exam/$track",
]);

/** Reports whether a link's route template names a prerendered page, which the link loads as a document. */
export function isPrerenderedRouteTarget(to: string | undefined): boolean {
  return to !== undefined && HashSet.has(PRERENDERED_ROUTE_TEMPLATES, to);
}
