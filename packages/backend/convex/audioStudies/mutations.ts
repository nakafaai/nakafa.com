import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  contentIdValidator,
  contentTypeValidator,
} from "@repo/backend/convex/audioStudies/schema";
import { audioStatusValidator } from "@repo/backend/convex/lib/contentValidators";
import { vv } from "@repo/backend/convex/lib/validators";
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
      await ctx.db.patch("contentAudios", audio._id, {
        contentHash: args.newHash,
        status: "pending",
        script: undefined,
        audioStorageId: undefined,
        audioDuration: undefined,
        audioSize: undefined,
        errorMessage: undefined,
        failedAt: undefined,
        updatedAt: Date.now(),
      });

      updatedCount++;
    }

    return { updatedCount };
  },
});
