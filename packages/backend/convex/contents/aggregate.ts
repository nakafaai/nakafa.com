import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Tracks global article popularity across all locales.
 * Used for audio generation queue prioritization.
 *
 * Note: Uses count() instead of sum() since each record represents 1 view.
 * Per Convex best practices: count records, don't sum redundant fields.
 */
export const articlePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"articleContents">];
  DataModel: DataModel;
  TableName: "articleContentViews";
}>(components.articlePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [0, doc.contentId], // Key format: [count placeholder, contentId]
  // No sumValue - we use count() to count records, not sum a field
});

/**
 * Tracks global subject section popularity across all locales.
 * Used for audio generation queue prioritization.
 */
export const subjectPopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"subjectSections">];
  DataModel: DataModel;
  TableName: "subjectContentViews";
}>(components.subjectPopularity, {
  namespace: () => "global",
  sortKey: (doc) => [0, doc.contentId],
});

/**
 * Tracks global exercise popularity across all locales.
 * Not used for audio generation (exercises don't have audio).
 */
export const exercisePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"exerciseSets">];
  DataModel: DataModel;
  TableName: "exerciseContentViews";
}>(components.exercisePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [0, doc.contentId],
});
