/** Public Nakafa website origin used for canonical content URLs. */
export const nakafaBaseUrl = "https://nakafa.com";

/** Public Nakafa content sections exposed to agents and Convex search. */
export const nakafaSections = [
  "articles",
  "subject",
  "exercises",
  "quran",
] as const;

/** Default item count for paginated Nakafa search results. */
export const nakafaSearchDefaultLimit = 20;

/** Hard cap for paginated Nakafa search results. */
export const nakafaSearchMaxLimit = 50;

/** Hard cap for offset pagination within Convex full-text scan limits. */
export const nakafaSearchMaxOffset = 950;
