import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Global aggregate for article content popularity tracking.
 *
 * Design:
 * - Table: articleContentViews (specific ID type, no union!)
 * - Namespace: "global" (single namespace combining all locales)
 * - Key: [viewCount, contentId] - composite key for sorting by popularity
 * - Sum: viewCount (total views across ALL locales for priority calculation)
 *
 * Sort Strategy:
 * - Primary sort: viewCount (descending = most popular first)
 * - Tie-breaker: contentId (ensures uniqueness for composite key)
 * - This enables paginate with order:"desc" to return most viewed items
 *
 * Benefits:
 * - Popular content gets audio in ALL locales, not just its primary locale
 * - Single global ranking regardless of where views come from
 * - No cross-type contention with subjects
 * - Zero type assertions anywhere in the codebase
 */
export const articlePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"articleContents">];
  DataModel: DataModel;
  TableName: "articleContentViews";
}>(components.articlePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});

/**
 * Global aggregate for subject section popularity tracking.
 *
 * Design:
 * - Table: subjectContentViews (specific ID type, no union!)
 * - Namespace: "global" (single namespace combining all locales)
 * - Key: [viewCount, contentId] - composite key for sorting by popularity
 * - Sum: viewCount (total views across ALL locales)
 *
 * Sort Strategy:
 * - Primary sort: viewCount (descending = most popular first)
 * - Tie-breaker: contentId (ensures uniqueness for composite key)
 * - This enables paginate with order:"desc" to return most viewed items
 *
 * Benefits:
 * - Popular content gets audio in ALL locales
 * - Single global ranking regardless of where views come from
 * - No cross-type contention with articles
 * - Zero type assertions anywhere in the codebase
 */
export const subjectPopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"subjectSections">];
  DataModel: DataModel;
  TableName: "subjectContentViews";
}>(components.subjectPopularity, {
  namespace: () => "global",
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});

/**
 * Global aggregate for exercise popularity tracking.
 *
 * Design:
 * - Table: exerciseContentViews (specific ID type, no union!)
 * - Namespace: "global" (single namespace combining all locales)
 * - Key: [viewCount, contentId] - composite key for sorting by popularity
 * - Sum: viewCount (total views across ALL locales)
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
 * but we track global popularity for trending features.
 */
export const exercisePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"exerciseSets">];
  DataModel: DataModel;
  TableName: "exerciseContentViews";
}>(components.exercisePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});
