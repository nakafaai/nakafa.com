import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE } from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import {
  evaluateTryoutScaleQuality,
  scaleQualityRebuildResultValidator,
  upsertTryoutScaleQualityCheck,
} from "@repo/backend/convex/irt/scales/quality";
import { irtScaleQualityRefreshWorkpool } from "@repo/backend/convex/irt/workpool";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

/** Recompute and persist one tryout's current official-scale readiness summary. */
export const refreshScaleQualityCheck = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const summary = await evaluateTryoutScaleQuality(ctx.db, {
      now: Date.now(),
      tryoutId: args.tryoutId,
    });

    if (!summary) {
      return null;
    }

    await upsertTryoutScaleQualityCheck(ctx.db, summary);
    return null;
  },
});

/** Schedule bounded scale-quality refresh work for every tryout. */
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
      const pendingScalePublication = await ctx.db
        .query("irtScalePublicationQueue")
        .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
          q.eq("tryoutId", tryout._id)
        )
        .first();

      if (pendingScalePublication) {
        continue;
      }

      await irtScaleQualityRefreshWorkpool.enqueueMutation(
        ctx,
        internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
        { tryoutId: tryout._id }
      );
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

/** Drain one bounded batch of queued tryout scale publications. */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const queueEntries = await ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_enqueuedAt")
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);

    const distinctTryoutIds = [
      ...new Set(queueEntries.map((entry) => entry.tryoutId)),
    ];

    for (const tryoutId of distinctTryoutIds) {
      await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);

      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.queue
          .cleanupScalePublicationQueueEntries,
        {
          tryoutId,
        }
      );
    }

    return null;
  },
});
