import { internalMutation } from "@repo/backend/convex/functions";
import {
  deleteActivePlanItemsForStaleCoverage,
  reconcileActivePlanItemsForCoverageRefresh,
} from "@repo/backend/convex/learningPrograms/reconcile";
import { learningProgramCoverageInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import { ConvexError, v } from "convex/values";

const STALE_COVERAGE_DELETE_LIMIT = 200;
const syncResultValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  updated: v.number(),
});
const deleteResultValidator = v.object({
  deleted: v.number(),
});

/** Upserts graph-backed program coverage rows from the content sync projection. */
export const syncLearningProgramCoverage = internalMutation({
  args: {
    coverageRows: v.array(learningProgramCoverageInputValidator),
  },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const row of args.coverageRows) {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", row.programKey))
        .unique();

      if (!program) {
        skipped++;
        continue;
      }

      const existing = await ctx.db
        .query("learningProgramCoverage")
        .withIndex("by_programId_and_locale_and_lensId", (q) =>
          q
            .eq("programId", program._id)
            .eq("locale", row.locale)
            .eq("lensId", row.lensId)
        )
        .unique();
      const patch = {
        contentCount: row.contentCount,
        coverageStatus: row.coverageStatus,
        lensId: row.lensId,
        lensScope: row.lensScope,
        locale: row.locale,
        programId: program._id,
        programKey: program.key,
        sampleContentId: row.sampleContentId,
        syncedAt: row.syncedAt,
      };

      if (!existing) {
        await ctx.db.insert("learningProgramCoverage", patch);
        created++;
        continue;
      }

      await reconcileActivePlanItemsForCoverageRefresh(ctx, {
        coverage: existing,
        nextCoverageStatus: row.coverageStatus,
        nextSampleContentId: row.sampleContentId,
        updatedBefore: row.syncedAt,
      });
      await ctx.db.patch(existing._id, patch);
      updated++;
    }

    return { created, skipped, updated };
  },
});

/** Deletes older derived coverage rows for one locale through bounded batches. */
export const deleteStaleLearningProgramCoverage = internalMutation({
  args: {
    limit: v.number(),
    locale: learningProgramCoverageInputValidator.fields.locale,
    syncedAt: v.number(),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    if (args.limit < 1 || args.limit > STALE_COVERAGE_DELETE_LIMIT) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_COVERAGE_DELETE_LIMIT_INVALID",
        message: `Learning program coverage delete limit must be between 1 and ${STALE_COVERAGE_DELETE_LIMIT}.`,
      });
    }

    const staleRows = await ctx.db
      .query("learningProgramCoverage")
      .withIndex("by_locale_and_syncedAt", (q) =>
        q.eq("locale", args.locale).lt("syncedAt", args.syncedAt)
      )
      .take(args.limit);

    for (const row of staleRows) {
      await deleteActivePlanItemsForStaleCoverage(ctx, row);
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});
