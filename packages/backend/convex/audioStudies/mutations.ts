import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  CLEANUP_CONFIG,
  isAudioGenerationEnabled,
  MAX_CONTENT_PER_DAY,
} from "@repo/backend/convex/audioStudies/constants";
import { getResetAudioFields } from "@repo/backend/convex/audioStudies/utils";
import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { ConvexError, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Save generated script to content audio and update status.
 * Idempotent: Saving same script is a no-op.
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

    // Idempotent: Skip if script already exists and matches
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
 * Atomically claim script generation to prevent race conditions.
 * Returns true if successfully claimed (status was "pending"), false otherwise.
 * This prevents duplicate script generation when multiple workers try simultaneously.
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

    // Only claim if currently pending (not claimed by another worker)
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
 * Atomically claim speech generation to prevent race conditions.
 * Returns true if successfully claimed (status was "script-generated"), false otherwise.
 * This prevents duplicate speech generation when multiple workers try simultaneously.
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

    // Only claim if script is generated but speech not started
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
 * Save generated audio metadata.
 * Idempotent: Saving same storage ID is a no-op.
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

    // Idempotent: Skip if already completed with same storage ID
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
 * Mark audio generation as failed.
 * Idempotent: Skip if already reset to pending by content change.
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

    // Idempotent: Skip if already reset to "pending" by updateContentHash.
    // This handles the race condition where content changes during generation.
    if (audio.status === "pending") {
      return null;
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      status: "failed",
      errorMessage: args.error,
      failedAt: Date.now(),
      generationAttempts: audio.generationAttempts + 1,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Update content hash and clear outdated audio data.
 * Called when content is updated to invalidate cached audio.
 * Idempotent: Skip if hash already matches.
 *
 * Type Safety:
 * - Uses discriminated contentRef for type-safe lookups
 * - TypeScript narrows the type automatically in the switch
 * - No assertions needed
 */
export const updateContentHash = internalMutation({
  args: {
    contentRef: audioContentRefValidator,
    newHash: v.string(),
  },
  returns: v.object({ updatedCount: v.number() }),
  handler: async (ctx, args) => {
    // Query using discriminated ref fields
    const audios = await ctx.db
      .query("contentAudios")
      .withIndex("contentRef", (q) =>
        q
          .eq("contentRef.type", args.contentRef.type)
          .eq("contentRef.id", args.contentRef.id)
      )
      .collect();

    let updatedCount = 0;

    for (const audio of audios) {
      // Idempotent: Skip if hash already matches
      if (audio.contentHash === args.newHash) {
        continue;
      }

      // Delete old audio file from storage (save space)
      if (audio.audioStorageId) {
        await ctx.storage.delete(audio.audioStorageId);
      }

      // Update record with new hash and clear old data
      // Reset generationAttempts to 0 for new content version
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
 * Atomically lock a queue item by marking it as processing.
 * Idempotent: Returns null if item is no longer pending.
 *
 * Returns discriminated contentRef for type-safe usage in workflow.
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

    // Idempotent: Only lock if still pending
    // If another worker already locked it, return null
    if (item.status !== "pending") {
      return null;
    }

    // Enforce retry limits to prevent infinite loops on permanently failing content
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
 * Create contentAudios record if it doesn't exist, or return existing.
 * Idempotent: Multiple calls with same content+locale return same ID.
 * Requires contentHash to enable cost protection during generation.
 *
 * Uses discriminated contentRef for type-safe storage.
 */
export const createOrGetAudioRecord = internalMutation({
  args: {
    contentRef: audioContentRefValidator,
    locale: localeValidator,
    contentHash: v.string(),
  },
  returns: v.id("contentAudios"),
  handler: async (ctx, args) => {
    // Check if record already exists using discriminated ref
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
      // Content changed - reset all generated data to force regeneration
      // This handles race condition where content updates between queue population
      // and workflow execution
      if (existing.contentHash !== args.contentHash) {
        await ctx.db.patch(
          "contentAudios",
          existing._id,
          getResetAudioFields(args.contentHash)
        );
      }
      return existing._id;
    }

    // Get voice config for this locale
    const voiceConfig = getVoiceConfig(DEFAULT_VOICE_KEY);

    // Create new record with discriminated contentRef
    // Convex handles race conditions automatically via OCC (Optimistic Concurrency Control)
    // Per best practices: "you can simply write your mutation functions as if they will always succeed"
    const now = Date.now();
    const id = await ctx.db.insert("contentAudios", {
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

    return id;
  },
});

/**
 * Mark queue item as completed.
 * Idempotent: Skip if already completed or item not found.
 */
export const markQueueCompleted = internalMutation({
  args: {
    queueItemId: vv.id("audioGenerationQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("audioGenerationQueue", args.queueItemId);

    if (!item) {
      // Item may have been cleaned up, treat as success
      return null;
    }

    // Idempotent: Skip if already completed
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
 * Mark queue item as failed.
 * Idempotent: Skip if already failed or completed.
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
      // Item may have been cleaned up, treat as success
      return null;
    }

    // Idempotent: Skip if already in a terminal state
    if (item.status === "completed" || item.status === "failed") {
      return null;
    }

    const now = Date.now();
    const newRetryCount = item.retryCount + 1;

    await ctx.db.patch("audioGenerationQueue", args.queueItemId, {
      status: "failed",
      errorMessage: args.error,
      lastErrorAt: now,
      retryCount: newRetryCount,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Start workflows for pending queue items.
 * Called by cron every 5 minutes.
 *
 * Strategy: Process 1 content piece per day with ALL locales.
 * This ensures complete multilingual coverage for popular content.
 *
 * Example: MAX_CONTENT_PER_DAY = 1, SUPPORTED_LOCALES = ["en", "id"]
 * Result: 1 content × 2 locales = 2 audio files per day
 */
export const startWorkflowsForPendingItems = internalMutation({
  args: {},
  returns: v.object({
    started: v.number(),
    skipped: v.number(),
    contentRef: v.optional(audioContentRefValidator),
  }),
  handler: async (ctx) => {
    // Check if audio generation is enabled for this deployment
    // Set ENABLE_AUDIO_GENERATION=true in Convex Dashboard to enable
    if (!isAudioGenerationEnabled()) {
      logger.info(
        "Audio generation skipped - ENABLE_AUDIO_GENERATION not set in environment"
      );
      return { started: 0, skipped: 0 };
    }

    const now = Date.now();
    const today = new Date(now).setHours(0, 0, 0, 0);

    // Count unique content pieces completed today
    // We count by contentRef (type + id), not by locale
    const completedToday = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_completedAt", (q) =>
        q.eq("status", "completed").gte("completedAt", today)
      )
      .collect();

    // Use a Set to track unique content pieces (by contentRef)
    const completedContentRefs = new Set<string>();
    for (const item of completedToday) {
      const contentRefKey = `${item.contentRef.type}:${item.contentRef.id}`;
      completedContentRefs.add(contentRefKey);
    }

    // Check if we've reached the daily limit for content pieces
    if (completedContentRefs.size >= MAX_CONTENT_PER_DAY) {
      logger.info(
        `Daily content limit reached: ${completedContentRefs.size}/${MAX_CONTENT_PER_DAY} content pieces completed today`
      );
      return { started: 0, skipped: 0 };
    }

    // Get the highest priority pending item
    // This determines which content piece to process today
    const topItem = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_priority", (q) => q.eq("status", "pending"))
      .order("desc")
      .first();

    if (!topItem) {
      logger.info("No pending items in queue");
      return { started: 0, skipped: 0 };
    }

    // Get ALL pending queue items for this content (all locales)
    // We want to process all locales of the same content together
    const contentItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("contentRef_locale", (q) =>
        q
          .eq("contentRef.type", topItem.contentRef.type)
          .eq("contentRef.id", topItem.contentRef.id)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    let started = 0;

    // Start workflows for all locales of this content
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

    logger.info(
      `Started audio generation for ${started} locales of content ${topItem.contentRef.type}:${topItem.contentRef.id}`
    );

    return {
      started,
      skipped: 0,
      contentRef: topItem.contentRef,
    };
  },
});

/**
 * Cleanup old queue records.
 * Removes completed/failed items older than retention period.
 * Idempotent: Safe to run multiple times.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx) => {
    const cutoffDate =
      Date.now() - CLEANUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

    // Query completed items using index
    const completedOldItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_updatedAt", (q) =>
        q.eq("status", "completed").lt("updatedAt", cutoffDate)
      )
      .collect();

    // Query failed items using index
    const failedOldItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_updatedAt", (q) =>
        q.eq("status", "failed").lt("updatedAt", cutoffDate)
      )
      .collect();

    // Delete all old items
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
