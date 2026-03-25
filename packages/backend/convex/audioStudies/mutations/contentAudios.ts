import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import {
  claimContentAudioGeneration,
  collapseDuplicateContentAudioRecords,
  loadContentAudioRecords,
  requireContentAudio,
} from "@repo/backend/convex/audioStudies/helpers/contentAudios";
import {
  getResetAudioFields,
  updateContentHash as updateContentAudioHash,
} from "@repo/backend/convex/audioStudies/utils";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  type AudioStatus,
  audioContentRefValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

type ClaimableStatus = Extract<AudioStatus, "pending" | "script-generated">;

/** Saves generated script. Idempotent. */
export const saveScript = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    script: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await requireContentAudio(ctx, args.contentAudioId);

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

/** Claim script generation atomically for fresh or retry-safe work. */
export const claimScriptGeneration = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) =>
    claimContentAudioGeneration(ctx, {
      allowedStatuses: ["pending", "generating-script"],
      contentAudioId: args.contentAudioId,
      nextStatus: "generating-script",
    }),
});

/** Claim speech generation atomically for fresh or retry-safe work. */
export const claimSpeechGeneration = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) =>
    claimContentAudioGeneration(ctx, {
      allowedStatuses: ["script-generated", "generating-speech"],
      contentAudioId: args.contentAudioId,
      nextStatus: "generating-speech",
    }),
});

/** Saves generated audio metadata. Idempotent. */
export const saveAudio = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    storageId: v.id("_storage"),
    duration: v.number(),
    size: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await requireContentAudio(ctx, args.contentAudioId);

    if (
      audio.status === "completed" &&
      audio.audioStorageId === args.storageId
    ) {
      return null;
    }

    if (audio.audioStorageId && audio.audioStorageId !== args.storageId) {
      await ctx.storage.delete(audio.audioStorageId);
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
 * Mark one failed audio generation step and reset the row to the next retryable
 * status.
 */
export const markFailed = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await requireContentAudio(ctx, args.contentAudioId);

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

/** Update one content hash and clear outdated generated audio data. */
export const updateContentHash = internalMutation({
  args: {
    contentRef: audioContentRefValidator,
    newHash: v.string(),
  },
  returns: v.object({ updatedCount: v.number() }),
  handler: async (ctx, args) => ({
    updatedCount: await updateContentAudioHash(
      ctx,
      args.contentRef,
      args.newHash
    ),
  }),
});

/** Create or reuse the locale-specific audio record behind one queue item. */
export const createOrGetAudioRecord = internalMutation({
  args: {
    contentRef: audioContentRefValidator,
    locale: localeValidator,
    contentHash: v.string(),
  },
  returns: v.id("contentAudios"),
  handler: async (ctx, args) => {
    const existingRecords = await loadContentAudioRecords(ctx, {
      contentRef: args.contentRef,
      locale: args.locale,
    });
    const existing =
      existingRecords.length <= 1
        ? existingRecords[0]
        : await collapseDuplicateContentAudioRecords(ctx, existingRecords);

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

    const keeper = await collapseDuplicateContentAudioRecords(
      ctx,
      await loadContentAudioRecords(ctx, {
        contentRef: args.contentRef,
        locale: args.locale,
      })
    );

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
