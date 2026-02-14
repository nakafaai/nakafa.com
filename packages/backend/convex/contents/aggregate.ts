import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/**
 * Aggregate for article content popularity tracking.
 *
 * Design:
 * - Table: articleContentViews (specific ID type, no union!)
 * - Namespace: Locale type ("en" | "id") for type-safe locale handling
 * - Key: [viewCount, contentId] - composite key for sorting by popularity
 * - Sum: viewCount (total views for priority calculation)
 *
 * Sort Strategy:
 * - Primary sort: viewCount (descending = most popular first)
 * - Tie-breaker: contentId (ensures uniqueness for composite key)
 * - This enables paginate with order:"desc" to return most viewed items
 *
 * Benefits:
 * - Type-safe: Locale type prevents invalid namespace values
 * - Scalable: Independent from subject popularity aggregate
 * - No cross-type contention with subjects
 * - Zero type assertions anywhere in the codebase
 */
export const articlePopularity = new TableAggregate<{
  Namespace: Locale;
  Key: [number, Id<"articleContents">];
  DataModel: DataModel;
  TableName: "articleContentViews";
}>(components.articlePopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});

/**
 * Aggregate for subject section popularity tracking.
 *
 * Design:
 * - Table: subjectContentViews (specific ID type, no union!)
 * - Namespace: Locale type ("en" | "id") for type-safe locale handling
 * - Key: [viewCount, contentId] - composite key for sorting by popularity
 * - Sum: viewCount (total views for priority calculation)
 *
 * Sort Strategy:
 * - Primary sort: viewCount (descending = most popular first)
 * - Tie-breaker: contentId (ensures uniqueness for composite key)
 * - This enables paginate with order:"desc" to return most viewed items
 *
 * Benefits:
 * - Type-safe: Locale type prevents invalid namespace values
 * - Scalable: Independent from article popularity aggregate
 * - No cross-type contention with articles
 * - Zero type assertions anywhere in the codebase
 */
export const subjectPopularity = new TableAggregate<{
  Namespace: Locale;
  Key: [number, Id<"subjectSections">];
  DataModel: DataModel;
  TableName: "subjectContentViews";
}>(components.subjectPopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});

/**
 * Aggregate for exercise popularity tracking.
 *
 * Design:
 * - Table: exerciseContentViews (specific ID type, no union!)
 * - Namespace: Locale type ("en" | "id") for type-safe locale handling
 * - Key: [viewCount, contentId] - composite key for sorting by popularity
 * - Sum: viewCount (total views for popularity calculation)
 *
 * Sort Strategy:
 * - Primary sort: viewCount (descending = most popular first)
 * - Tie-breaker: contentId (ensures uniqueness for composite key)
 * - This enables paginate with order:"desc" to return most viewed items
 *
 * Purpose:
 * - Enables trending exercises feature (frontend can query later)
 * - Statistics tracking for exercise engagement
 * - Future-proof: Ready for trending queries when needed
 *
 * Note: Exercises are NOT queued for audio generation (by design),
 * but we track popularity for trending features.
 */
export const exercisePopularity = new TableAggregate<{
  Namespace: Locale;
  Key: [number, Id<"exerciseSets">];
  DataModel: DataModel;
  TableName: "exerciseContentViews";
}>(components.exercisePopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});
