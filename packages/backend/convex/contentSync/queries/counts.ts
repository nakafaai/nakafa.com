import { internalQuery } from "@repo/backend/convex/_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const countableTableNameValidator = literals(
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
  "authors",
  "contentAuthors",
  "articleReferences",
  "exerciseChoices"
);

const countTablePageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  pageSize: v.number(),
});

/** Returns the size of one paginated table slice for sync verification scripts. */
export const countTablePage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    tableName: countableTableNameValidator,
  },
  returns: countTablePageResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.tableName)
      .paginate(args.paginationOpts);

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      pageSize: page.page.length,
    };
  },
});
