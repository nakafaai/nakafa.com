import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  CLEANUP_CONFIG,
  DAILY_GENERATION_LIMITS,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import { audioStatusValidator } from "@repo/backend/convex/lib/validators/audio";
import {
  contentIdValidator,
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { ConvexError, v } from "convex/values";

/**
 * Update audio generation status.
 * Used by workflow to track progress through generation stages.
 */
export const updateStatus = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    status: audioStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio not found",
      });
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Save generated script to content audio and update status.
 * Called after successful script generation.
 */
export const saveScript = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    script: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio not found",
      });
    }

    await ctx.db.patch(args.contentAudioId, {
      script: args.script,
      status: "script-generated",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Mark speech generation as starting.
 * Called at the beginning of speech generation.
 */
export const startSpeechGeneration = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio not found",
      });
    }

    await ctx.db.patch(args.contentAudioId, {
      status: "generating-speech",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Save generated audio metadata.
 * Called after successful speech generation.
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
        message: "Audio not found",
      });
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
 * Called when script or speech generation fails.
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
        message: "Audio not found",
      });
    }

    // Idempotent: Skip if already reset to "pending" by updateContentHash.
    // This handles the race condition where content changes during generation.
    // updateContentHash sets status to "pending" for the new content version,
    // so we should NOT overwrite it back to "failed".
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
 * Deletes old audio file from storage and resets for regeneration.
 */
export const updateContentHash = internalMutation({
  args: {
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    newHash: v.string(),
  },
  returns: v.object({ updatedCount: v.number() }),
  handler: async (ctx, args) => {
    const audios = await ctx.db
      .query("contentAudios")
      .withIndex("content", (q) =>
        q.eq("contentId", args.contentId).eq("contentType", args.contentType)
      )
      .collect();

    let updatedCount = 0;

    for (const audio of audios) {
      // Skip if hash already matches (idempotent)
      if (audio.contentHash === args.newHash) {
        continue;
      }

      // Delete old audio file from storage (save space)
      if (audio.audioStorageId) {
        await ctx.storage.delete(audio.audioStorageId);
      }

      // Update record with new hash and clear old data
      // Reset generationAttempts to 0 for new content version
      await ctx.db.patch("contentAudios", audio._id, {
        contentHash: args.newHash,
        status: "pending",
        script: undefined,
        audioStorageId: undefined,
        audioDuration: undefined,
        audioSize: undefined,
        errorMessage: undefined,
        failedAt: undefined,
        generationAttempts: 0,
        updatedAt: Date.now(),
      });

      updatedCount++;
    }

    return { updatedCount };
  },
});

/**
 * Populate audio generation queue from aggregated popularity data.
 * Runs every hour via cron.
 */
export const populateQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Get pending items that need audio generation
    const queueItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_priority", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);

    for (const item of queueItems) {
      // Check if contentAudios record exists
      const existing = await ctx.db
        .query("contentAudios")
        .withIndex("content_locale", (q) =>
          q
            .eq("contentId", item.contentId)
            .eq("contentType", item.contentType)
            .eq("locale", item.locale)
        )
        .first();

      if (!existing) {
        // Create placeholder record for workflow
        await ctx.db.insert("contentAudios", {
          contentId: item.contentId,
          contentType: item.contentType,
          locale: item.locale,
          contentHash: "pending", // Will be updated by workflow
          voiceId: "default", // Will be set by workflow
          model: "eleven_v3",
          status: "pending",
          generationAttempts: 0,
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

/**
 * Process audio generation queue.
 * Respects daily limits per locale.
 */
export const processQueue = internalMutation({
  args: { maxItems: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date(now).setHours(0, 0, 0, 0);

    // Count today's completions per locale using index for efficient date filtering
    const completedToday = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_completedAt", (q) =>
        q.eq("status", "completed").gte("completedAt", today)
      )
      .collect();

    const countsByLocale: Record<string, number> = {};
    for (const locale of SUPPORTED_LOCALES) {
      countsByLocale[locale] = 0;
    }
    for (const item of completedToday) {
      countsByLocale[item.locale]++;
    }

    // Get pending items
    const pending = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("status_priority", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(args.maxItems);

    for (const item of pending) {
      // Check daily limit
      if (countsByLocale[item.locale] >= DAILY_GENERATION_LIMITS[item.locale]) {
        continue;
      }

      // Update status
      await ctx.db.patch(item._id, {
        status: "processing",
        processingStartedAt: now,
        updatedAt: now,
      });

      // Get or create contentAudios record
      let audioRecord = await ctx.db
        .query("contentAudios")
        .withIndex("content_locale", (q) =>
          q
            .eq("contentId", item.contentId)
            .eq("contentType", item.contentType)
            .eq("locale", item.locale)
        )
        .first();

      if (!audioRecord) {
        const id = await ctx.db.insert("contentAudios", {
          contentId: item.contentId,
          contentType: item.contentType,
          locale: item.locale,
          contentHash: "pending",
          voiceId: "default",
          model: "eleven_v3",
          status: "pending",
          generationAttempts: 0,
          updatedAt: now,
        });
        audioRecord = await ctx.db.get(id);
      }

      // Trigger workflow
      if (audioRecord) {
        await workflow.start(
          ctx,
          internal.audioStudies.workflows.generateAudio,
          {
            contentAudioId: audioRecord._id,
          }
        );
      }

      countsByLocale[item.locale]++;
    }

    return null;
  },
});

/**
 * Cleanup old queue records.
 * Removes completed/failed items older than 30 days.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
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
    for (const item of completedOldItems) {
      await ctx.db.delete(item._id);
    }
    for (const item of failedOldItems) {
      await ctx.db.delete(item._id);
    }

    return null;
  },
});

/**
 * Create contentAudios record if it doesn't exist, or return existing.
 * Used by generateAudioForContent workflow.
 */
export const createOrGetAudioRecord = internalMutation({
  args: {
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    locale: localeValidator,
  },
  returns: v.id("contentAudios"),
  handler: async (ctx, args) => {
    // Check if record already exists
    const existing = await ctx.db
      .query("contentAudios")
      .withIndex("content_locale", (q) =>
        q
          .eq("contentId", args.contentId)
          .eq("contentType", args.contentType)
          .eq("locale", args.locale)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new record with default voice
    const id = await ctx.db.insert("contentAudios", {
      contentId: args.contentId,
      contentType: args.contentType,
      locale: args.locale,
      contentHash: "pending",
      voiceId: "default", // Will be set by workflow
      model: "eleven_v3",
      status: "pending",
      generationAttempts: 0,
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Mark queue item as completed after successful audio generation.
 */
export const markQueueCompleted = internalMutation({
  args: {
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    locale: localeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const queueItems = await ctx.db
      .query("audioGenerationQueue")
      .withIndex("content", (q) =>
        q
          .eq("contentId", args.contentId)
          .eq("contentType", args.contentType)
          .eq("locale", args.locale)
      )
      .collect();

    // Filter in code for processing status
    const queueItem = queueItems.find((item) => item.status === "processing");

    if (queueItem) {
      await ctx.db.patch(queueItem._id, {
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});
