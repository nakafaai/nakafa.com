import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import {
  evaluateTryoutScaleQuality,
  scaleQualityRebuildResultValidator,
  upsertTryoutScaleQualityCheck,
} from "@repo/backend/convex/irt/scales/quality";
import { vv } from "@repo/backend/convex/lib/validators/vv";
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
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await refreshScaleQualityCheckInPlace(ctx.db, args.tryoutId);
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

      await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId: tryout._id,
        enqueuedAt,
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
        { cursor: page.continueCursor }
      );
    }

    if (args.cursor === undefined && page.page.length > 0) {
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
    refreshedCount: v.number(),
  }),
  handler: async (ctx) => {
    const queueEntries = await ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_enqueuedAt")
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

    if (queueEntries.length === IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
        {}
      );
    }

    return {
      processedCount: queueEntries.length,
      refreshedCount,
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

      await ctx.db.insert("irtScaleQualityRefreshQueue", {
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
