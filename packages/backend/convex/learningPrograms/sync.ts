import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { getContentRouteByContentId } from "@repo/backend/convex/learningPrograms/impl";
import {
  deleteOmittedCatalogProgramBatch,
  deleteOmittedCatalogPrograms,
} from "@repo/backend/convex/learningPrograms/omitted";
import {
  learningProgramCoverageInputValidator,
  learningProgramInputValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { syncProgramSources } from "@repo/backend/convex/learningPrograms/sources";
import { LearningProgramSchema } from "@repo/contents/_types/program/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { Either, Schema } from "effect";

const STALE_COVERAGE_DELETE_LIMIT = 200;
const ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE = 100;
const LearningProgramSyncInputSchema = Schema.Array(LearningProgramSchema);

const syncResultValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  updated: v.number(),
});
const deleteResultValidator = v.object({
  deleted: v.number(),
});
const planItemReconcileResultValidator = v.object({
  reconciled: v.number(),
  scheduled: v.boolean(),
});

/** Upserts the program catalog and its source references from contents contracts. */
export const syncLearningPrograms = internalMutation({
  args: {
    programs: v.array(learningProgramInputValidator),
    syncedAt: v.number(),
  },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    const programs = decodeLearningProgramsForSync(args.programs);

    if (programs.length === 0) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_CATALOG_EMPTY",
        message: "Learning program catalog sync requires at least one row.",
      });
    }

    let created = 0;
    let updated = 0;

    for (const program of programs) {
      const existing = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", program.key))
        .unique();
      const row = {
        defaultCoverageStatus: program.defaultCoverageStatus,
        displayOrder: program.displayOrder,
        iconKey: program.iconKey,
        key: program.key,
        kind: program.kind,
        navigation: {
          levels: [...program.navigation.levels],
          model: program.navigation.model,
        },
        providerHomeCountry: program.provider.homeCountry,
        providerKind: program.provider.kind,
        providerName: program.provider.name,
        recommendedCountry: program.recommendedCountry,
        syncedAt: args.syncedAt,
        translations: program.translations,
        updatedAt: args.syncedAt,
        versionEndsAt: program.version.endsAt,
        versionLabel: program.version.label,
        versionStartsAt: program.version.startsAt,
      };

      const programId = existing
        ? existing._id
        : await ctx.db.insert("learningPrograms", row);

      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated++;
      } else {
        created++;
      }

      await syncProgramSources(ctx, {
        programId,
        sources: program.sources,
        syncedAt: args.syncedAt,
      });
    }

    updated += await deleteOmittedCatalogPrograms(ctx, {
      incomingKeys: new Set(programs.map((program) => program.key)),
      omittedAt: args.syncedAt,
    });

    return { created, skipped: 0, updated };
  },
});

/** Continues bounded omitted-program dependency cleanup after a catalog sync. */
export const continueOmittedProgramDelete = internalMutation({
  args: {
    omittedAt: v.number(),
    programId: v.id("learningPrograms"),
  },
  returns: v.object({
    deleted: v.boolean(),
    scheduled: v.boolean(),
  }),
  handler: async (ctx, args) =>
    await deleteOmittedCatalogProgramBatch(ctx, args),
});

/** Decodes sync rows through the Effect-owned program registry contract before writes. */
function decodeLearningProgramsForSync(
  programs: Infer<typeof learningProgramInputValidator>[]
) {
  const decoded = Schema.decodeUnknownEither(LearningProgramSyncInputSchema)(
    programs
  );

  if (Either.isLeft(decoded)) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_CATALOG_INVALID",
      message:
        "Learning program catalog sync received rows outside the contents registry contract.",
    });
  }

  return decoded.right;
}

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

/** Continues a generated plan-item reconcile after a coverage sample changes. */
export const continueCoverageSamplePlanItemReconcile = internalMutation({
  args: {
    lensId: v.string(),
    locale: learningProgramCoverageInputValidator.fields.locale,
    nextCoverageStatus:
      learningProgramCoverageInputValidator.fields.coverageStatus,
    nextSampleContentId:
      learningProgramCoverageInputValidator.fields.sampleContentId,
    previousSampleContentId:
      learningProgramCoverageInputValidator.fields.sampleContentId,
    programId: v.id("learningPrograms"),
    updatedBefore: v.number(),
  },
  returns: planItemReconcileResultValidator,
  handler: async (ctx, args) =>
    await reconcileCoverageSamplePlanItemBatch(ctx, args),
});

/** Continues generated plan-item deletion after a stale coverage row disappears. */
export const continueStaleCoveragePlanItemDelete = internalMutation({
  args: {
    lensId: v.string(),
    sampleContentId:
      learningProgramCoverageInputValidator.fields.sampleContentId,
    programId: v.id("learningPrograms"),
  },
  returns: planItemReconcileResultValidator,
  handler: async (ctx, args) =>
    await deleteStaleCoveragePlanItemBatch(ctx, args),
});

/** Refreshes generated plan items when coverage keeps its key but its sample, route, or title projection changes. */
async function reconcileActivePlanItemsForCoverageRefresh(
  ctx: MutationCtx,
  {
    coverage,
    nextCoverageStatus,
    nextSampleContentId,
    updatedBefore,
  }: {
    coverage: Doc<"learningProgramCoverage">;
    nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
    nextSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
    updatedBefore: number;
  }
) {
  await reconcileCoverageSamplePlanItemBatch(ctx, {
    lensId: coverage.lensId,
    locale: coverage.locale,
    nextCoverageStatus,
    nextSampleContentId,
    previousSampleContentId: coverage.sampleContentId,
    programId: coverage.programId,
    updatedBefore,
  });
}

/** Reconciles one bounded page of generated plan items for a changed coverage sample. */
async function reconcileCoverageSamplePlanItemBatch(
  ctx: MutationCtx,
  {
    lensId,
    locale,
    nextCoverageStatus,
    nextSampleContentId,
    previousSampleContentId,
    programId,
    updatedBefore,
  }: {
    lensId: string;
    locale: Doc<"learningProgramCoverage">["locale"];
    nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
    nextSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
    previousSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
    programId: Id<"learningPrograms">;
    updatedBefore: number;
  }
) {
  const keepsSameContentId = previousSampleContentId === nextSampleContentId;
  const planItems = keepsSameContentId
    ? await ctx.db
        .query("learningPlanItems")
        .withIndex(
          "by_programId_and_lensId_and_content_id_and_updatedAt",
          (q) =>
            q
              .eq("programId", programId)
              .eq("lensId", lensId)
              .eq("content_id", previousSampleContentId)
              .lt("updatedAt", updatedBefore)
        )
        .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE)
    : await ctx.db
        .query("learningPlanItems")
        .withIndex("by_programId_and_lensId_and_content_id", (q) =>
          q
            .eq("programId", programId)
            .eq("lensId", lensId)
            .eq("content_id", previousSampleContentId)
        )
        .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE);

  const route = await getContentRouteByContentId(ctx, {
    contentId: nextSampleContentId,
    locale,
  });
  let reconciled = 0;

  for (const item of planItems) {
    const plan = await ctx.db.get(item.planId);

    if (!plan) {
      await ctx.db.delete(item._id);
      continue;
    }

    if (!route) {
      await ctx.db.delete(item._id);
      reconciled++;
      continue;
    }

    await ctx.db.patch(item._id, {
      content_id: nextSampleContentId,
      coverageStatus: nextCoverageStatus,
      route: route.route,
      title: route.title,
      updatedAt: updatedBefore,
    });
    reconciled++;
  }

  const scheduled = planItems.length === ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE;

  if (scheduled) {
    const continuationArgs = {
      lensId,
      locale,
      nextCoverageStatus,
      nextSampleContentId,
      previousSampleContentId,
      programId,
      updatedBefore,
    };

    await ctx.scheduler.runAfter(
      0,
      internal.learningPrograms.sync.continueCoverageSamplePlanItemReconcile,
      continuationArgs
    );
  }

  return { reconciled, scheduled };
}

/** Removes generated active-plan items before their source coverage row disappears. */
async function deleteActivePlanItemsForStaleCoverage(
  ctx: MutationCtx,
  coverage: Doc<"learningProgramCoverage">
) {
  await deleteStaleCoveragePlanItemBatch(ctx, {
    lensId: coverage.lensId,
    programId: coverage.programId,
    sampleContentId: coverage.sampleContentId,
  });
}

/** Deletes one bounded page of generated plan items for removed coverage. */
async function deleteStaleCoveragePlanItemBatch(
  ctx: MutationCtx,
  {
    lensId,
    programId,
    sampleContentId,
  }: {
    lensId: string;
    programId: Id<"learningPrograms">;
    sampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
  }
) {
  const planItems = await ctx.db
    .query("learningPlanItems")
    .withIndex("by_programId_and_lensId_and_content_id", (q) =>
      q
        .eq("programId", programId)
        .eq("lensId", lensId)
        .eq("content_id", sampleContentId)
    )
    .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE);
  let reconciled = 0;

  for (const item of planItems) {
    await ctx.db.delete(item._id);
    reconciled++;
  }

  const scheduled = planItems.length === ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE;

  if (scheduled) {
    await ctx.scheduler.runAfter(
      0,
      internal.learningPrograms.sync.continueStaleCoveragePlanItemDelete,
      {
        lensId,
        programId,
        sampleContentId,
      }
    );
  }

  return { reconciled, scheduled };
}
