import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Tracks article popularity per-locale (not globally combined).
 * Each locale version (e.g., en/matematika vs id/matematika) ranks independently.
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
 * Tracks subject section popularity per-locale.
 * Each locale version ranks independently for language-specific trending.
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
 * Tracks exercise popularity per-locale for trending analytics.
 * Not used for audio generation (exercises don't have audio).
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
