/**
 * The route templates whose pages the build prerenders as static assets. Their
 * loaders read the answers that the build keeps beside the pages, so a link to one
 * navigates in the browser and no Worker renders it. A try-out track reads the
 * learner's attempts, so it renders on the Worker and is not here. The sign-in
 * page is here: a visitor gets its static page, and only a request that holds a
 * session reaches the Worker's router (`answerStaticPath`).
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
] as const;
