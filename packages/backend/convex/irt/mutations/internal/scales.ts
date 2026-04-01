import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  IRT_QUEUE_SEALING_MS,
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import {
  evaluateTryoutScaleQuality,
  scaleQualityRebuildResultValidator,
  upsertTryoutScaleQualityCheck,
} from "@repo/backend/convex/irt/scales/quality";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

async function refreshScaleQualityCheckInPlace(
  db: MutationCtx["db"],
  tryoutId: Id<"tryouts">
) {
  const summary = await evaluateTryoutScaleQuality(db, {
    now: Date.now(),
    tryoutId,
  });

  if (!summary) {
    return false;
  }

  await upsertTryoutScaleQualityCheck(db, summary);
  return true;
}

/** Recompute and persist one tryout's current official-scale readiness summary. */
export const refreshScaleQualityCheck = internalMutation({
  args: {
    tryoutId: v.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await refreshScaleQualityCheckInPlace(ctx.db, args.tryoutId);
    return null;
  },
});

/** Queue every tryout for a later sealed-batch quality refresh. */
export const rebuildScaleQualityChecksPage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: scaleQualityRebuildResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query("tryouts").paginate({
      cursor: args.cursor ?? null,
      numItems: SCALE_QUALITY_REBUILD_BATCH_SIZE,
    });

    for (const tryout of page.page) {
      await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId: tryout._id,
        enqueuedAt: Date.now(),
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
        { cursor: page.continueCursor }
      );
    }

    return {
      isDone: page.isDone,
      processedCount: page.page.length,
    };
  },
});

/** Drain one bounded batch of sealed scale-quality refresh rows. */
export const drainScaleQualityRefreshQueue = internalMutation({
  args: {},
  returns: v.object({
    processedCount: v.number(),
    refreshedCount: v.number(),
  }),
  handler: async (ctx) => {
    const sealedBeforeAt = Date.now() - IRT_QUEUE_SEALING_MS;
    const queueEntries = await ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_enqueuedAt", (q) => q.lt("enqueuedAt", sealedBeforeAt))
      .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE);

    if (queueEntries.length === 0) {
      return {
        processedCount: 0,
        refreshedCount: 0,
      };
    }

    const tryoutIds = [...new Set(queueEntries.map((entry) => entry.tryoutId))];
    let refreshedCount = 0;

    for (const tryoutId of tryoutIds) {
      const refreshed = await refreshScaleQualityCheckInPlace(ctx.db, tryoutId);

      if (refreshed) {
        refreshedCount += 1;
      }
    }

    for (const queueEntry of queueEntries) {
      await ctx.db.delete("irtScaleQualityRefreshQueue", queueEntry._id);
    }

    logger.info("Drained IRT scale quality refresh queue", {
      processedCount: queueEntries.length,
      refreshedCount,
    });

    return {
      processedCount: queueEntries.length,
      refreshedCount,
    };
  },
});

/** Drain one bounded batch of sealed tryout scale publication rows. */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const sealedBeforeAt = Date.now() - IRT_QUEUE_SEALING_MS;
    const queueEntries = await ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_enqueuedAt", (q) => q.lt("enqueuedAt", sealedBeforeAt))
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);

    if (queueEntries.length === 0) {
      return null;
    }

    const distinctTryoutIds = [
      ...new Set(queueEntries.map((entry) => entry.tryoutId)),
    ];

    for (const tryoutId of distinctTryoutIds) {
      const throughAt = queueEntries
        .filter((entry) => entry.tryoutId === tryoutId)
        .reduce(
          (latestEnqueuedAt, entry) =>
            Math.max(latestEnqueuedAt, entry.enqueuedAt),
          0
        );

      await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);
      await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId,
        enqueuedAt: Date.now(),
      });

      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.queue
          .cleanupScalePublicationQueueEntries,
        {
          throughAt,
          tryoutId,
        }
      );
    }

    return null;
  },
});
