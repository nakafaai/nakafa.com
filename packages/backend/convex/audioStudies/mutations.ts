import { internalMutation } from "@repo/backend/convex/_generated/server";
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
 * Save generated script to content audio.
 * Called after successful script generation.
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
        message: "Audio not found",
      });
    }

    await ctx.db.patch("contentAudios", args.contentAudioId, {
      script: args.script,
      status: "completed",
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
      updatedAt: Date.now(),
    });

    return null;
  },
});
