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
 * - Key: Id<"articleContents"> (simple ID, zero assertions!)
 * - Sum: viewCount (total views for priority calculation)
 *
 * Benefits:
 * - Type-safe: Locale type prevents invalid namespace values
 * - Scalable: Independent from subject popularity aggregate
 * - No cross-type contention with subjects
 * - Zero type assertions anywhere in the codebase
 */
export const articlePopularity = new TableAggregate<{
  Namespace: Locale;
  Key: Id<"articleContents">;
  DataModel: DataModel;
  TableName: "articleContentViews";
}>(components.articlePopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => doc.contentId,
  sumValue: (doc) => doc.viewCount,
});

/**
 * Aggregate for subject section popularity tracking.
 *
 * Design:
 * - Table: subjectContentViews (specific ID type, no union!)
 * - Namespace: Locale type ("en" | "id") for type-safe locale handling
 * - Key: Id<"subjectSections"> (simple ID, zero assertions!)
 * - Sum: viewCount (total views for priority calculation)
 *
 * Benefits:
 * - Type-safe: Locale type prevents invalid namespace values
 * - Scalable: Independent from article popularity aggregate
 * - No cross-type contention with articles
 * - Zero type assertions anywhere in the codebase
 */
export const subjectPopularity = new TableAggregate<{
  Namespace: Locale;
  Key: Id<"subjectSections">;
  DataModel: DataModel;
  TableName: "subjectContentViews";
}>(components.subjectPopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => doc.contentId,
  sumValue: (doc) => doc.viewCount,
});

/**
 * Aggregate for exercise popularity tracking.
 *
 * Design:
 * - Table: exerciseContentViews (specific ID type, no union!)
 * - Namespace: Locale type ("en" | "id") for type-safe locale handling
 * - Key: Id<"exerciseSets"> (simple ID, zero assertions!)
 * - Sum: viewCount (total views for popularity calculation)
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
  Key: Id<"exerciseSets">;
  DataModel: DataModel;
  TableName: "exerciseContentViews";
}>(components.exercisePopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => doc.contentId,
  sumValue: (doc) => doc.viewCount,
});
