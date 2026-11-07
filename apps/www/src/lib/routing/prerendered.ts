/**
 * The route templates whose pages the build prerenders as static assets. Their
 * loaders read the answers that the build keeps beside the pages, so a link to one
 * navigates in the browser and no Worker renders it. The sign-in page and the
 * try-out pages are here too: every reader gets the same static page, and the page
 * itself sends a signed-in reader on, or reads their attempt, in the browser.
 */
export const PRERENDERED_ROUTE_TEMPLATES = [
  "/$locale",
  "/$locale/$",
  "/$locale/articles",
  "/$locale/articles/$category",
  "/$locale/articles/$category/$slug",
  "/$locale/auth",
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
