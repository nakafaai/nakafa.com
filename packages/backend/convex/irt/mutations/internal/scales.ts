import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  IRT_QUEUE_SEALING_MS,
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
  IRT_SCALE_PUBLICATION_QUEUE_SCAN_PAGE_LIMIT,
  IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import {
  evaluateTryoutScaleQuality,
  scaleQualityRebuildResultValidator,
  upsertTryoutScaleQualityCheck,
} from "@repo/backend/convex/irt/scales/quality";
import { irtScaleMaintenanceWorkpool } from "@repo/backend/convex/irt/workpool";
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

/** Enqueue one serialized scale-quality refresh drain. */
export const scheduleScaleQualityRefreshQueueDrain = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await irtScaleMaintenanceWorkpool.enqueueMutation(
      ctx,
      internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
      {}
    );

    return null;
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

/** Enqueue one serialized scale-publication drain. */
export const scheduleScalePublicationQueueDrain = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await irtScaleMaintenanceWorkpool.enqueueMutation(
      ctx,
      internal.irt.mutations.internal.scales.drainScalePublicationQueue,
      {}
    );

    return null;
  },
});

/** Drain one bounded batch of sealed tryout scale publication rows. */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const sealedBeforeAt = Date.now() - IRT_QUEUE_SEALING_MS;
    const distinctTryoutIds: Id<"tryouts">[] = [];
    const throughAtByTryoutId = new Map<string, number>();
    let cursor: string | null = null;
    let scannedPages = 0;
    let reachedEnd = false;

    while (
      distinctTryoutIds.length < IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE &&
      scannedPages < IRT_SCALE_PUBLICATION_QUEUE_SCAN_PAGE_LIMIT &&
      !reachedEnd
    ) {
      const page = await ctx.db
        .query("irtScalePublicationQueue")
        .withIndex("by_enqueuedAt", (q) => q.lt("enqueuedAt", sealedBeforeAt))
        .paginate({
          cursor,
          numItems: IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
        });
      scannedPages += 1;

      if (page.page.length === 0) {
        break;
      }

      for (const queueEntry of page.page) {
        const tryoutId = queueEntry.tryoutId;
        const existingThroughAt = throughAtByTryoutId.get(tryoutId) ?? 0;
        throughAtByTryoutId.set(
          tryoutId,
          Math.max(existingThroughAt, queueEntry.enqueuedAt)
        );

        if (distinctTryoutIds.includes(tryoutId)) {
          continue;
        }

        distinctTryoutIds.push(tryoutId);

        if (
          distinctTryoutIds.length === IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE
        ) {
          break;
        }
      }

      cursor = page.continueCursor;
      reachedEnd = page.isDone;
    }

    for (const tryoutId of distinctTryoutIds) {
      const throughAt = throughAtByTryoutId.get(tryoutId);

      if (!throughAt) {
        continue;
      }

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
