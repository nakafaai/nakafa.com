/** Number of queued analytics rows processed in one mutation. */
export const CONTENT_ANALYTICS_BATCH_SIZE = 250;

/** Number of independent analytics partitions. */
export const CONTENT_ANALYTICS_PARTITION_COUNT = 16;

/** Duration a partition lease stays active before recovery can reclaim it. */
export const CONTENT_ANALYTICS_LEASE_DURATION_MS = 5 * 60 * 1000;

/** Stable list of analytics partitions used by cron scheduling. */
export const CONTENT_ANALYTICS_PARTITIONS = Array.from(
  { length: CONTENT_ANALYTICS_PARTITION_COUNT },
  (_, partition) => partition
);

/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_CONTENT_BASE_URL = "https://nakafa.com";

/** Public content sections persisted in the Convex content search read model. */
export const NAKAFA_CONTENT_SECTIONS = [
  "articles",
  "subject",
  "exercises",
  "quran",
] as const;

/** Default public content search page size. */
export const CONTENT_SEARCH_DEFAULT_LIMIT = 20;

/** Maximum public content search page size. */
export const CONTENT_SEARCH_MAX_LIMIT = 50;

/** Maximum public content search offset. */
export const CONTENT_SEARCH_MAX_OFFSET = 950;

/** Maximum unique query strings accepted in one content search request. */
export const CONTENT_SEARCH_MAX_QUERIES = 4;

/** Batch limits used by content sync scripts and backend maintenance jobs. */
export const CONTENT_SYNC_BATCH_LIMITS = {
  articles: 50,
  articleReferences: 100,
  authors: 50,
  exerciseChoices: 10,
  exerciseQuestions: 30,
  exerciseSets: 50,
  quranSearchDocuments: 50,
  staleArticles: 50,
  staleExerciseQuestions: 100,
  staleExerciseSets: 5,
  staleSubjectSections: 50,
  staleSubjectTopics: 20,
  subjectSections: 20,
  subjectTopics: 50,
  tryoutDetectionSets: 500,
  unusedAuthors: 50,
} as const;
