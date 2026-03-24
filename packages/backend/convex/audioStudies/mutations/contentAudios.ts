import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getResetAudioFields,
  updateContentHash as updateContentAudioHash,
} from "@repo/backend/convex/audioStudies/utils";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  type AudioContentRef,
  type AudioStatus,
  audioContentRefValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

type ClaimableStatus = Extract<AudioStatus, "pending" | "script-generated">;
const CONTENT_AUDIO_DUPLICATE_LIMIT = 3;

/** Load one content audio row or fail with a precise not-found error. */
async function requireContentAudio(
  ctx: MutationCtx,
  contentAudioId: Doc<"contentAudios">["_id"]
) {
  const audio = await ctx.db.get("contentAudios", contentAudioId);

  if (audio) {
    return audio;
  }

  throw new ConvexError({
    code: "NOT_FOUND",
    message: "Audio record not found",
  });
}

/** Load the canonical content-audio rows for one content ref + locale. */
async function loadContentAudioRecords(
  ctx: MutationCtx,
  {
    contentRef,
    locale,
  }: {
    contentRef: AudioContentRef;
    locale: Doc<"contentAudios">["locale"];
  }
) {
  const records = await ctx.db
    .query("contentAudios")
    .withIndex("contentRef_locale", (q) =>
      q
        .eq("contentRef.type", contentRef.type)
        .eq("contentRef.id", contentRef.id)
        .eq("locale", locale)
    )
    .take(CONTENT_AUDIO_DUPLICATE_LIMIT);

  if (records.length < CONTENT_AUDIO_DUPLICATE_LIMIT) {
    return records;
  }

  throw new ConvexError({
    code: "CONTENT_AUDIO_DUPLICATE_LIMIT_EXCEEDED",
    message: "Content audio duplicate limit exceeded.",
  });
}

/** Keep the earliest content-audio row as the canonical record for one key. */
async function collapseDuplicateContentAudioRecords(
  ctx: MutationCtx,
  records: Doc<"contentAudios">[]
) {
  const [keeper, ...duplicates] = records;

  if (!keeper) {
    throw new ConvexError({
      code: "CONTENT_AUDIO_NOT_FOUND",
      message: "Content audio record not found.",
    });
  }

  for (const duplicate of duplicates) {
    await ctx.db.delete("contentAudios", duplicate._id);
  }

  return keeper;
}

/**
 * Claim one content-audio state transition only when the current status allows
 * a retry-safe workflow step to continue.
 */
async function claimContentAudioGeneration(
  ctx: MutationCtx,
  {
    allowedStatuses,
    contentAudioId,
    nextStatus,
  }: {
    allowedStatuses: AudioStatus[];
    contentAudioId: Doc<"contentAudios">["_id"];
    nextStatus: AudioStatus;
  }
) {
  const audio = await requireContentAudio(ctx, contentAudioId);

  if (!allowedStatuses.includes(audio.status)) {
    return false;
  }

  await ctx.db.patch("contentAudios", contentAudioId, {
    status: nextStatus,
    updatedAt: Date.now(),
  });

  return true;
}

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
