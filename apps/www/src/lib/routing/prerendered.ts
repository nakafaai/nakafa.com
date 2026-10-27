/**
 * The route templates whose pages the build prerenders as static assets. Their
 * loaders read the answers that the build keeps beside the pages, so a link to one
 * navigates in the browser and no Worker renders it. A try-out track, set and
 * section prerender a visitor's answer, and a learner's own answer reads from the
 * server once the page has hydrated (ADR 0038 Phase B).
 */
export const PRERENDERED_ROUTE_TEMPLATES = [
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
  "/$locale/try-out/$country/$exam/$track/$set",
  "/$locale/try-out/$country/$exam/$track/$set/$section",
] as const;
