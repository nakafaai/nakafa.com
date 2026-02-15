import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Tracks global article popularity across all locales.
 * Each record represents 1 unique view.
 */
export const articlePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"articleContents">];
  DataModel: DataModel;
  TableName: "articleContentViews";
}>(components.articlePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [0, doc.contentId],
});

/**
 * Tracks global subject section popularity across all locales.
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
 * Not used for audio generation.
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
