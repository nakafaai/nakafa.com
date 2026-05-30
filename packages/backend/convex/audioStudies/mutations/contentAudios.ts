import {
  claimAudioScriptGeneration,
  claimAudioSpeechGeneration,
  createOrGetContentAudio,
  markContentAudioGenerationFailed,
  saveAudioScript,
  saveGeneratedAudio,
} from "@repo/backend/convex/audioStudies/contentAudios/impl";
import {
  contentAudioIdArgs,
  createOrGetContentAudioArgs,
  markContentAudioFailedArgs,
  saveAudioScriptArgs,
  saveGeneratedAudioArgs,
} from "@repo/backend/convex/audioStudies/contentAudios/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Saves generated script. Idempotent. */
export const saveScript = internalMutation({
  args: saveAudioScriptArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(saveAudioScript(ctx, args)),
});

/** Claim script generation atomically for fresh or retry-safe work. */
export const claimScriptGeneration = internalMutation({
  args: contentAudioIdArgs,
  returns: v.boolean(),
  handler: async (ctx, args) =>
    await runConvexProgram(claimAudioScriptGeneration(ctx, args)),
});

/** Claim speech generation atomically for fresh or retry-safe work. */
export const claimSpeechGeneration = internalMutation({
  args: contentAudioIdArgs,
  returns: v.boolean(),
  handler: async (ctx, args) =>
    await runConvexProgram(claimAudioSpeechGeneration(ctx, args)),
});

/** Saves generated audio metadata. Idempotent. */
export const saveAudio = internalMutation({
  args: saveGeneratedAudioArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(saveGeneratedAudio(ctx, args)),
});

/**
 * Mark one failed audio generation step and reset the row to the next retryable
 * status.
 */
export const markFailed = internalMutation({
  args: markContentAudioFailedArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(markContentAudioGenerationFailed(ctx, args)),
});

/** Create or reuse the locale-specific audio record behind one queue item. */
export const createOrGetAudioRecord = internalMutation({
  args: createOrGetContentAudioArgs,
  returns: v.id("contentAudios"),
  handler: async (ctx, args) =>
    await runConvexProgram(createOrGetContentAudio(ctx, args)),
});
