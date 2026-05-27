import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const contentSyncQueriesCountsGroup = GroupSpec.make("counts").addFunction(
  FunctionSpec.internalQuery({
    name: "countTablePage",
    args: Schema.Struct({
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
      tableName: Schema.Literal(
        "articleContents",
        "subjectTopics",
        "subjectSections",
        "exerciseSets",
        "exerciseQuestions",
        "exerciseAttempts",
        "exerciseAnswers",
        "tryoutAccessCampaigns",
        "tryoutAccessCampaignProducts",
        "tryoutAccessLinks",
        "tryoutAccessGrants",
        "tryouts",
        "tryoutCatalogMeta",
        "userTryoutEntitlements",
        "tryoutPartSets",
        "tryoutAttempts",
        "tryoutPartAttempts",
        "tryoutLeaderboardEntries",
        "userTryoutStats",
        "irtCalibrationQueue",
        "irtCalibrationAttempts",
        "irtCalibrationCacheStats",
        "irtScaleQualityChecks",
        "irtScaleQualityRefreshQueue",
        "irtCalibrationRuns",
        "exerciseItemParameters",
        "irtScalePublicationQueue",
        "irtScaleVersions",
        "irtScaleVersionItems",
        "contentSearch",
        "authors",
        "contentAuthors",
        "articleReferences",
        "exerciseChoices"
      ),
    }),
    returns: Schema.Struct({
      continueCursor: Schema.String,
      isDone: Schema.Boolean,
      pageSize: Schema.Number,
    }),
  })
);

export { contentSyncQueriesCountsGroup };
