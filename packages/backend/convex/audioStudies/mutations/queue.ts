import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CLEANUP_CONFIG,
  getMaxContentPerDay,
  isAudioGenerationEnabled,
  QUEUE_TIMEOUT_MS,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { ConvexError, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

const AUDIO_QUEUE_PER_SLUG_LIMIT = SUPPORTED_LOCALES.length + 1;

/** Mark one queue item completed unless it is already terminal. */
export async function markQueueCompleted(
  ctx: MutationCtx,
  queueItemId: Id<"audioGenerationQueue">
) {
  const item = await ctx.db.get("audioGenerationQueue", queueItemId);

  if (!item || item.status === "completed") {
    return null;
  }

  const now = Date.now();
  await ctx.db.patch("audioGenerationQueue", queueItemId, {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  });

  return null;
}

/** Mark one queue item failed or reset it for retry, depending on retry budget. */
export async function setQueueItemFailed(
  ctx: MutationCtx,
  {
    error,
    queueItemId,
  }: {
    error: string;
    queueItemId: Id<"audioGenerationQueue">;
  }
) {
  const item = await ctx.db.get("audioGenerationQueue", queueItemId);

  if (!item || item.status === "completed" || item.status === "failed") {
    return null;
  }

  const now = Date.now();
  const nextRetryCount = item.retryCount + 1;

  if (nextRetryCount >= item.maxRetries) {
    await ctx.db.patch("audioGenerationQueue", queueItemId, {
      status: "failed",
      errorMessage: `Max retries exceeded (${item.maxRetries}): ${error}`,
      lastErrorAt: now,
      retryCount: nextRetryCount,
      updatedAt: now,
    });

    return null;
  }

  await ctx.db.patch("audioGenerationQueue", queueItemId, {
    status: "pending",
    errorMessage: error,
    lastErrorAt: now,
    retryCount: nextRetryCount,
    updatedAt: now,
  });

  return null;
}

/** Lock one queue item by marking it as processing. */
export const lockQueueItem = internalMutation({
  args: {
    queueItemId: vv.id("audioGenerationQueue"),
  },
  returns: nullable(
    v.object({
      contentRef: audioContentRefValidator,
      locale: localeValidator,
    })
  ),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("audioGenerationQueue", args.queueItemId);

    if (!item) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Queue item not found",
      });
    }

    if (item.status !== "pending") {
      return null;
    }

    if (item.retryCount >= item.maxRetries) {
      await ctx.db.patch("audioGenerationQueue", args.queueItemId, {
        status: "failed",
        errorMessage: `Exceeded maximum retry attempts (${item.maxRetries})`,
        updatedAt: Date.now(),
      });
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("audioGenerationQueue", args.queueItemId, {
      status: "processing",
      processingStartedAt: now,
      updatedAt: now,
    });

    return {
      contentRef: item.contentRef,
      locale: item.locale,
    };
  },
});

/** Mark one queue item failed from an internal mutation entrypoint. */
export const markQueueFailed = internalMutation({
  args: {
    queueItemId: vv.id("audioGenerationQueue"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    setQueueItemFailed(ctx, {
      error: args.error,
      queueItemId: args.queueItemId,
    }),
});

/**
 * Start workflows for the next pending slug, processing all pending locales for
 * that slug together.
 */
export const startWorkflowsForPendingItems = internalMutation({
  args: {},
  returns: v.object({
    started: v.number(),
    skipped: v.number(),
    contentRef: v.optional(audioContentRefValidator),
  }),
  handler: async (ctx) => {
    if (!isAudioGenerationEnabled()) {
      logger.info("Audio generation skipped - ENABLE_AUDIO_GENERATION not set");
      return { started: 0, skipped: 0 };
    }

    const now = Date.now();
    const today = new Date(now).setHours(0, 0, 0, 0);
    const maxContentPerDay = getMaxContentPerDay();
    const completedToday = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_completedAt", (q) =>
        q.eq("status", "completed").gte("completedAt", today)
      )
      .take(maxContentPerDay + 10);
    const completedSlugs = new Set<string>();

    for (const item of completedToday) {
      completedSlugs.add(item.slug);
    }

    if (completedSlugs.size >= maxContentPerDay) {
      logger.info(
        `Daily limit reached: ${completedSlugs.size}/${maxContentPerDay}`
      );
      return { started: 0, skipped: 0 };
    }

    const topItem = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_priority", (q) => q.eq("status", "pending"))
      .order("desc")
      .first();

    if (!topItem) {
      logger.info("No pending items");
      return { started: 0, skipped: 0 };
    }

    const contentItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("slug_status", (q) =>
        q.eq("slug", topItem.slug).eq("status", "pending")
      )
      .take(AUDIO_QUEUE_PER_SLUG_LIMIT);

    if (contentItems.length > SUPPORTED_LOCALES.length) {
      throw new ConvexError({
        code: "AUDIO_QUEUE_LOCALE_COUNT_EXCEEDED",
        message: "Audio queue slug exceeded the supported locale count.",
      });
    }

    let started = 0;

    for (const item of contentItems) {
      await workflow.start(
        ctx,
        internal.audioStudies.workflows.generateAudioForQueueItem,
        {
          queueItemId: item._id,
        },
        {
          onComplete: internal.audioStudies.workflows.handleWorkflowComplete,
          context: { queueItemId: item._id },
        }
      );

      started += 1;
    }

    logger.info(`Started ${started} locales for content: ${topItem.slug}`);

    return {
      started,
      skipped: 0,
      contentRef: topItem.contentRef,
    };
  },
});

/** Clean up old completed and failed queue rows in bounded batches. */
export const cleanup = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx) => {
    const cutoffDate =
      Date.now() - CLEANUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;
    const completedOldItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_updatedAt", (q) =>
        q.eq("status", "completed").lt("updatedAt", cutoffDate)
      )
      .take(100);
    const failedOldItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_updatedAt", (q) =>
        q.eq("status", "failed").lt("updatedAt", cutoffDate)
      )
      .take(100);

    let deleted = 0;

    for (const item of completedOldItems) {
      await ctx.db.delete("audioGenerationQueue", item._id);
      deleted += 1;
    }

    for (const item of failedOldItems) {
      await ctx.db.delete("audioGenerationQueue", item._id);
      deleted += 1;
    }

    if (deleted > 0) {
      logger.info("Cleaned up old queue items", { deleted });
    }

    return { deleted };
  },
});

/** Reset queue items stuck in processing long past the timeout window. */
export const resetStuckQueueItems = internalMutation({
  args: {},
  returns: v.object({
    reset: v.number(),
  }),
  handler: async (ctx) => {
    const stuckThreshold = Date.now() - QUEUE_TIMEOUT_MS;
    const stuckItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_updatedAt", (q) =>
        q.eq("status", "processing").lt("updatedAt", stuckThreshold)
      )
      .take(50);

    let reset = 0;

    for (const item of stuckItems) {
      if (item.retryCount >= item.maxRetries) {
        continue;
      }

      await ctx.db.patch("audioGenerationQueue", item._id, {
        status: "pending",
        retryCount: item.retryCount + 1,
        updatedAt: Date.now(),
      });
      reset += 1;
    }

    if (reset > 0) {
      logger.info(`Reset ${reset} stuck queue items to pending`);
    }

    return { reset };
  },
});
