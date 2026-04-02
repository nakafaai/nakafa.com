import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { enqueueScaleQualityRefresh } from "@repo/backend/convex/irt/helpers/queue";
import {
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import {
  refreshTryoutScaleQualityCheck,
  scaleQualityRebuildResultValidator,
} from "@repo/backend/convex/irt/scales/quality";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

/** Recompute and persist one tryout's current official-scale readiness summary. */
export const refreshScaleQualityCheck = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const queueEntries = await ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_tryoutId", (q) => q.eq("tryoutId", args.tryoutId))
      .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE);

    try {
      await refreshTryoutScaleQualityCheck(ctx.db, args.tryoutId);

      for (const queueEntry of queueEntries) {
        await ctx.db.delete("irtScaleQualityRefreshQueue", queueEntry._id);
      }

      return null;
    } catch (error) {
      const requeuedAt = Date.now();

      for (const queueEntry of queueEntries) {
        await ctx.db.replace("irtScaleQualityRefreshQueue", queueEntry._id, {
          tryoutId: queueEntry.tryoutId,
          enqueuedAt: requeuedAt,
        });
      }

      logger.error(
        "Scale quality refresh failed",
        {
          tryoutId: args.tryoutId,
          requeuedAt,
        },
        error
      );
    }

    return null;
  },
});

/** Queue bounded scale-quality refresh work for every tryout. */
export const rebuildScaleQualityChecksPage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: scaleQualityRebuildResultValidator,
  handler: async (ctx, args) => {
    const enqueuedAt = Date.now();
    let enqueuedAny = false;
    const page = await ctx.db.query("tryouts").paginate({
      cursor: args.cursor ?? null,
      numItems: SCALE_QUALITY_REBUILD_BATCH_SIZE,
    });

    for (const tryout of page.page) {
      const pendingScalePublication = await ctx.db
        .query("irtScalePublicationQueue")
        .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
          q.eq("tryoutId", tryout._id)
        )
        .first();

      if (pendingScalePublication) {
        continue;
      }

      const enqueued = await enqueueScaleQualityRefresh(ctx, {
        tryoutId: tryout._id,
        enqueuedAt,
      });

      enqueuedAny = enqueuedAny || enqueued;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
        { cursor: page.continueCursor }
      );
    }

    if (page.isDone && (args.cursor !== undefined || enqueuedAny)) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
        {}
      );
    }

    return {
      isDone: page.isDone,
      processedCount: page.page.length,
    };
  },
});

/** Drain one bounded batch of queued scale-quality refresh rows. */
export const drainScaleQualityRefreshQueue = internalMutation({
  args: {},
  returns: v.object({
    processedCount: v.number(),
    scheduledCount: v.number(),
  }),
  handler: async (ctx) => {
    const processingStartedAt = Date.now();
    const queueCandidates = await ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_enqueuedAt")
      .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE * 2);
    const queueEntries = queueCandidates
      .filter((entry) => entry.processingStartedAt === undefined)
      .slice(0, IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE);

    if (queueEntries.length === 0) {
      return {
        processedCount: 0,
        scheduledCount: 0,
      };
    }

    const tryoutIds = [...new Set(queueEntries.map((entry) => entry.tryoutId))];

    for (const queueEntry of queueEntries) {
      await ctx.db.patch("irtScaleQualityRefreshQueue", queueEntry._id, {
        processingStartedAt,
      });
    }

    for (const tryoutId of tryoutIds) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
        { tryoutId }
      );
    }

    if (queueEntries.length === IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
        {}
      );
    }

    return {
      processedCount: queueEntries.length,
      scheduledCount: tryoutIds.length,
    };
  },
});

/** Drain one bounded batch of queued tryout scale publications. */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const enqueuedAt = Date.now();
    const queueEntries = await ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_enqueuedAt")
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);

    const distinctTryoutIds = [
      ...new Set(queueEntries.map((entry) => entry.tryoutId)),
    ];

    for (const tryoutId of distinctTryoutIds) {
      await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);

      await enqueueScaleQualityRefresh(ctx, {
        tryoutId,
        enqueuedAt,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.queue
          .cleanupScalePublicationQueueEntries,
        {
          tryoutId,
        }
      );
    }

    if (distinctTryoutIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
        {}
      );
    }

    return null;
  },
});
