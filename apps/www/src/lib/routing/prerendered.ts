/**
 * The try-out track, set and section templates. The build prerenders a visitor's
 * page for each, and the Worker renders a learner's own page for their request
 * (`readVisitorAsset` and `isLearnerPage`, ADR 0038 Phase B), so the Worker runs
 * before the static assets beneath them (`workerSettings.assets`).
 */
export const LEARNER_ROUTE_TEMPLATES = [
  "/$locale/try-out/$country/$exam/$track",
  "/$locale/try-out/$country/$exam/$track/$set",
  "/$locale/try-out/$country/$exam/$track/$set/$section",
] as const;

/**
 * The route templates whose pages the build prerenders as static assets. Their
 * loaders read the answers that the build keeps beside the pages, so a link to one
 * navigates in the browser and no Worker renders it for a visitor.
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
  ...LEARNER_ROUTE_TEMPLATES,
] as const;
