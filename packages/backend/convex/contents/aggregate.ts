import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Aggregate for tracking article popularity by view count.
 */
export const articlePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"articleContents">];
  DataModel: DataModel;
  TableName: "articlePopularity";
}>(components.articlePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});

/**
 * Aggregate for tracking subject section popularity by view count.
 */
export const subjectPopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"subjectSections">];
  DataModel: DataModel;
  TableName: "subjectPopularity";
}>(components.subjectPopularity, {
  namespace: () => "global",
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});

/**
 * Aggregate for tracking exercise set popularity by view count.
 */
export const exercisePopularity = new TableAggregate<{
  Namespace: "global";
  Key: [number, Id<"exerciseSets">];
  DataModel: DataModel;
  TableName: "exercisePopularity";
}>(components.exercisePopularity, {
  namespace: () => "global",
  sortKey: (doc) => [doc.viewCount, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});
