import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  CLEANUP_CONFIG,
  getMaxContentPerDay,
  isAudioGenerationEnabled,
  QUEUE_TIMEOUT_MS,
} from "@repo/backend/convex/audioStudies/constants";
import { getResetAudioFields } from "@repo/backend/convex/audioStudies/utils";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  type AudioStatus,
  audioContentRefValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { ConvexError, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

type ClaimableStatus = Extract<AudioStatus, "pending" | "script-generated">;

/**
 * Saves generated script. Idempotent.
 */
export const saveScript = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    script: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio record not found",
      });
    }

    if (audio.script === args.script && audio.status === "script-generated") {
      return null;
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      script: args.script,
      status: "script-generated",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Claims script generation atomically to prevent race conditions.
 * Returns true if claimed (status was "pending").
 */
export const claimScriptGeneration = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio record not found",
      });
    }

    if (audio.status !== "pending") {
      return false;
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      status: "generating-script",
      updatedAt: Date.now(),
    });

    return true;
  },
});

/**
 * Claims speech generation atomically.
 * Returns true if claimed (status was "script-generated").
 */
export const claimSpeechGeneration = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio record not found",
      });
    }

    if (audio.status !== "script-generated") {
      return false;
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      status: "generating-speech",
      updatedAt: Date.now(),
    });

    return true;
  },
});

/**
 * Saves generated audio metadata. Idempotent.
 */
export const saveAudio = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    storageId: v.id("_storage"),
    duration: v.number(),
    size: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio record not found",
      });
    }

    if (
      audio.status === "completed" &&
      audio.audioStorageId === args.storageId
    ) {
      return null;
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      audioStorageId: args.storageId,
      audioDuration: args.duration,
      audioSize: args.size,
      status: "completed",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Marks generation as failed and resets status for workflow retries.
 * Resets "generating-script" → "pending" or "generating-speech" → "script-generated".
 */
export const markFailed = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio record not found",
      });
    }

    if (audio.status === "pending") {
      return null;
    }

    let resetStatus: ClaimableStatus;
    if (audio.status === "generating-script") {
      resetStatus = "pending";
    } else if (audio.status === "generating-speech") {
      resetStatus = "script-generated";
    } else {
      return null;
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      status: resetStatus,
      errorMessage: args.error,
      failedAt: Date.now(),
      generationAttempts: audio.generationAttempts + 1,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Updates content hash and clears outdated audio data when content changes.
 * Idempotent: Skips if hash already matches.
 */
export const updateContentHash = internalMutation({
  args: {
    contentRef: audioContentRefValidator,
    newHash: v.string(),
  },
  returns: v.object({ updatedCount: v.number() }),
  handler: async (ctx, args) => {
    // Bounded query: max 10 records (2 locales × safety margin)
    const audios = await ctx.db
      .query("contentAudios")
      .withIndex("contentRef_locale", (q) =>
        q
          .eq("contentRef.type", args.contentRef.type)
          .eq("contentRef.id", args.contentRef.id)
      )
      .take(10);

    let updatedCount = 0;

    for (const audio of audios) {
      if (audio.contentHash === args.newHash) {
        continue;
      }

      if (audio.audioStorageId) {
        await ctx.storage.delete(audio.audioStorageId);
      }

      await ctx.db.patch(
        "contentAudios",
        audio._id,
        getResetAudioFields(args.newHash)
      );

      updatedCount++;
    }

    return { updatedCount };
  },
});

/**
 * Locks a queue item by marking it as processing. Idempotent.
 * Returns null if item no longer pending or exceeded retry limit.
 */
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

    // Fail when maxRetries reached (allows attempts at counts 0 to maxRetries-1)
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

/**
 * Creates or returns existing audio record. Handles race conditions by deduplicating.
 */
export const createOrGetAudioRecord = internalMutation({
  args: {
    contentRef: audioContentRefValidator,
    locale: localeValidator,
    contentHash: v.string(),
  },
  returns: v.id("contentAudios"),
  handler: async (ctx, args) => {
    // First check for existing record
    const existing = await ctx.db
      .query("contentAudios")
      .withIndex("contentRef_locale", (q) =>
        q
          .eq("contentRef.type", args.contentRef.type)
          .eq("contentRef.id", args.contentRef.id)
          .eq("locale", args.locale)
      )
      .first();

    if (existing) {
      if (existing.contentHash !== args.contentHash) {
        await ctx.db.patch(
          "contentAudios",
          existing._id,
          getResetAudioFields(args.contentHash)
        );
      }
      return existing._id;
    }

    // No existing record found - create new one
    // Note: Due to Convex's serializable isolation, concurrent calls could
    // both reach this point and create duplicates. We handle this below.
    const voiceConfig = getVoiceConfig(DEFAULT_VOICE_KEY);
    const now = Date.now();

    await ctx.db.insert("contentAudios", {
      contentRef: args.contentRef,
      locale: args.locale,
      contentHash: args.contentHash,
      voiceId: voiceConfig.id,
      voiceSettings: voiceConfig.settings,
      model: ACTIVE_MODEL,
      status: "pending",
      generationAttempts: 0,
      updatedAt: now,
    });

    // Query again to handle race conditions
    // If concurrent calls created duplicates, get all and keep only one
    // Per Convex best practices: Use take() to bound the query
    // We expect 1-2 records max (normal case = 1, race condition = 2)
    const allRecords = await ctx.db
      .query("contentAudios")
      .withIndex("contentRef_locale", (q) =>
        q
          .eq("contentRef.type", args.contentRef.type)
          .eq("contentRef.id", args.contentRef.id)
          .eq("locale", args.locale)
      )
      .take(10);

    // Deduplicate: keep first, delete rest (expect 1-2 records max)
    const [keeper, ...duplicates] = allRecords;

    for (const duplicate of duplicates) {
      await ctx.db.delete("contentAudios", duplicate._id);
    }

    // If hash changed on the keeper record, reset it
    if (keeper.contentHash !== args.contentHash) {
      await ctx.db.patch(
        "contentAudios",
        keeper._id,
        getResetAudioFields(args.contentHash)
      );
    }

    return keeper._id;
  },
});

/**
 * Marks queue item as completed. Idempotent.
 */
export const markQueueCompleted = internalMutation({
  args: {
    queueItemId: vv.id("audioGenerationQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("audioGenerationQueue", args.queueItemId);

    if (!item) {
      return null;
    }

    if (item.status === "completed") {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("audioGenerationQueue", args.queueItemId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Marks queue item as failed. Prevents infinite retries by checking maxRetries.
 */
export const markQueueFailed = internalMutation({
  args: {
    queueItemId: vv.id("audioGenerationQueue"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("audioGenerationQueue", args.queueItemId);

    if (!item) {
      return null;
    }

    if (item.status === "completed" || item.status === "failed") {
      return null;
    }

    const now = Date.now();
    const newRetryCount = item.retryCount + 1;

    // Check if max retries exceeded
    if (newRetryCount > item.maxRetries) {
      // Permanent failure - max retries exhausted
      await ctx.db.patch("audioGenerationQueue", args.queueItemId, {
        status: "failed",
        errorMessage: `Max retries exceeded (${item.maxRetries}): ${args.error}`,
        lastErrorAt: now,
        retryCount: newRetryCount,
        updatedAt: now,
      });
      return null;
    }

    // Retries remaining - set back to pending for retry on next cron run
    await ctx.db.patch("audioGenerationQueue", args.queueItemId, {
      status: "pending",
      errorMessage: args.error,
      lastErrorAt: now,
      retryCount: newRetryCount,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Starts workflows for pending queue items. Called by cron every 30 minutes.
 * Processes 1 content piece per day (all locales together).
 * Respects LIMIT_AUDIO_GENERATION_PER_DAY env var.
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

    // Fetch completed items with limit to avoid loading entire table
    // Per Convex best practices: use take() instead of collect() for unbounded queries
    // We only need maxContentPerDay + buffer to determine if limit is reached
    const maxContentPerDay = getMaxContentPerDay();
    const completedToday = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_completedAt", (q) =>
        q.eq("status", "completed").gte("completedAt", today)
      )
      .take(maxContentPerDay + 10);

    // Count by slug (cross-locale), not contentRef (locale-specific)
    // This ensures all locales of 1 content piece count as 1 toward daily limit
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

    // Query all locales by slug (cross-locale processing)
    const contentItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("slug_status", (q) =>
        q.eq("slug", topItem.slug).eq("status", "pending")
      )
      .collect();

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

      started++;
    }

    logger.info(`Started ${started} locales for content: ${topItem.slug}`);

    return {
      started,
      skipped: 0,
      contentRef: topItem.contentRef,
    };
  },
});

/**
 * Cleans up old completed/failed queue records.
 * Runs daily at 2 AM via cron.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx) => {
    const cutoffDate =
      Date.now() - CLEANUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

    // Bounded query: max 100 records per cleanup run
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
      deleted++;
    }
    for (const item of failedOldItems) {
      await ctx.db.delete("audioGenerationQueue", item._id);
      deleted++;
    }

    return { deleted };
  },
});

/**
 * Resets queue items stuck in "processing" state (interrupted workflows).
 */
export const resetStuckQueueItems = internalMutation({
  args: {},
  returns: v.object({
    reset: v.number(),
  }),
  handler: async (ctx) => {
    const stuckThreshold = Date.now() - QUEUE_TIMEOUT_MS;

    // Bounded query: max 50 stuck items per run
    const stuckItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_updatedAt", (q) =>
        q.eq("status", "processing").lt("updatedAt", stuckThreshold)
      )
      .take(50);

    let reset = 0;
    for (const item of stuckItems) {
      // Reset if retryCount hasn't exceeded maxRetries (allows final attempt reset)
      if (item.retryCount <= item.maxRetries) {
        await ctx.db.patch("audioGenerationQueue", item._id, {
          status: "pending",
          retryCount: item.retryCount + 1,
          updatedAt: Date.now(),
        });
        reset++;
      }
    }

    if (reset > 0) {
      logger.info(`Reset ${reset} stuck queue items to pending`);
    }

    return { reset };
  },
});
