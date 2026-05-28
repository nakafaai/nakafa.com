import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import { ContentCountsSchema } from "@repo/backend/scripts/sync-content/schemas";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/types";
import { Effect, Schema } from "effect";

const COUNT_PAGE_SIZE = 1000;

type ContentCounts = Schema.Schema.Type<typeof ContentCountsSchema>;
type CountTableName = Ref.Args<
  typeof refs.internal.contentSync.queries.counts.countTablePage
>["tableName"];

const countTableSpecs: Array<{
  field: keyof ContentCounts;
  tableName: CountTableName;
}> = [
  { field: "articles", tableName: "articleContents" },
  { field: "subjectTopics", tableName: "subjectTopics" },
  { field: "subjectSections", tableName: "subjectSections" },
  { field: "exerciseSets", tableName: "exerciseSets" },
  { field: "exerciseQuestions", tableName: "exerciseQuestions" },
  { field: "exerciseAttempts", tableName: "exerciseAttempts" },
  { field: "exerciseAnswers", tableName: "exerciseAnswers" },
  { field: "tryoutAccessCampaigns", tableName: "tryoutAccessCampaigns" },
  {
    field: "tryoutAccessCampaignProducts",
    tableName: "tryoutAccessCampaignProducts",
  },
  { field: "tryoutAccessLinks", tableName: "tryoutAccessLinks" },
  { field: "tryoutAccessGrants", tableName: "tryoutAccessGrants" },
  { field: "tryouts", tableName: "tryouts" },
  { field: "tryoutCatalogMeta", tableName: "tryoutCatalogMeta" },
  { field: "userTryoutEntitlements", tableName: "userTryoutEntitlements" },
  { field: "tryoutPartSets", tableName: "tryoutPartSets" },
  { field: "tryoutAttempts", tableName: "tryoutAttempts" },
  { field: "tryoutPartAttempts", tableName: "tryoutPartAttempts" },
  {
    field: "tryoutLeaderboardEntries",
    tableName: "tryoutLeaderboardEntries",
  },
  { field: "userTryoutStats", tableName: "userTryoutStats" },
  { field: "irtCalibrationQueue", tableName: "irtCalibrationQueue" },
  {
    field: "irtCalibrationAttempts",
    tableName: "irtCalibrationAttempts",
  },
  {
    field: "irtCalibrationCacheStats",
    tableName: "irtCalibrationCacheStats",
  },
  { field: "irtCalibrationRuns", tableName: "irtCalibrationRuns" },
  { field: "irtScaleQualityChecks", tableName: "irtScaleQualityChecks" },
  {
    field: "irtScaleQualityRefreshQueue",
    tableName: "irtScaleQualityRefreshQueue",
  },
  { field: "exerciseItemParameters", tableName: "exerciseItemParameters" },
  {
    field: "irtScalePublicationQueue",
    tableName: "irtScalePublicationQueue",
  },
  { field: "irtScaleVersions", tableName: "irtScaleVersions" },
  { field: "irtScaleVersionItems", tableName: "irtScaleVersionItems" },
  { field: "contentSearch", tableName: "contentSearch" },
  { field: "authors", tableName: "authors" },
  { field: "contentAuthors", tableName: "contentAuthors" },
  { field: "articleReferences", tableName: "articleReferences" },
  { field: "exerciseChoices", tableName: "exerciseChoices" },
];

/** Counts every document in one Convex table through bounded paginated reads. */
const countTableDocuments = Effect.fn("sync.countTableDocuments")(function* (
  config: ConvexConfig,
  tableName: CountTableName
) {
  let count = 0;
  let continueCursor: string | null = null;
  let isDone = false;
  let pageSize = 0;

  while (!isDone) {
    ({ continueCursor, isDone, pageSize } = yield* callConvex(
      config,
      "query",
      refs.internal.contentSync.queries.counts.countTablePage,
      {
        tableName,
        paginationOpts: {
          cursor: continueCursor,
          numItems: COUNT_PAGE_SIZE,
        },
      }
    ));

    count += pageSize;
  }

  return count;
});

/** Loads the current row counts for every sync-managed content/runtime table. */
export const getContentCounts = Effect.fn("sync.getContentCounts")(function* (
  config: ConvexConfig
) {
  const entries: [keyof ContentCounts, number][] = [];

  for (const spec of countTableSpecs) {
    entries.push([
      spec.field,
      yield* countTableDocuments(config, spec.tableName),
    ]);
  }

  return Schema.decodeUnknownSync(ContentCountsSchema)(
    Object.fromEntries(entries)
  );
});
