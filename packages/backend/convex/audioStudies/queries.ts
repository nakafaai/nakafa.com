import { internalQuery } from "@repo/backend/convex/_generated/server";
import { fetchContentForAudio } from "@repo/backend/convex/audioStudies/utils";
import {
  audioModelValidator,
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import {
  contentIdValidator,
  contentTypeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Get content audio metadata by ID.
 * Used by workflow and actions to retrieve audio configuration.
 */
export const getById = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: nullable(
    v.object({
      contentId: contentIdValidator,
      contentType: contentTypeValidator,
      contentHash: v.string(),
      voiceId: v.string(),
      voiceSettings: v.optional(voiceSettingsValidator),
      model: audioModelValidator,
      status: audioStatusValidator,
    })
  ),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      return null;
    }

    return {
      contentId: audio.contentId,
      contentType: audio.contentType,
      contentHash: audio.contentHash,
      voiceId: audio.voiceId,
      voiceSettings: audio.voiceSettings,
      model: audio.model,
      status: audio.status,
    };
  },
});

/**
 * Get audio metadata and content data for script generation.
 * Returns both audio configuration and the associated content.
 */
export const getAudioAndContentForScriptGeneration = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: nullable(
    v.object({
      contentAudio: v.object({
        contentId: contentIdValidator,
        contentType: contentTypeValidator,
        contentHash: v.string(),
        voiceId: v.string(),
        voiceSettings: v.optional(voiceSettingsValidator),
        status: audioStatusValidator,
      }),
      content: v.object({
        title: v.string(),
        description: v.optional(v.string()),
        body: v.string(),
        locale: v.string(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      return null;
    }

    // Fetch content based on type - returns null if content not found
    const content = await fetchContentForAudio(ctx, audio);
    if (!content) {
      return null;
    }

    return {
      contentAudio: {
        contentId: audio.contentId,
        contentType: audio.contentType,
        contentHash: audio.contentHash,
        voiceId: audio.voiceId,
        voiceSettings: audio.voiceSettings,
        status: audio.status,
      },
      content,
    };
  },
});

/**
 * Get audio metadata with script for speech generation.
 * Returns script, voice configuration, content hash, and model for verification.
 */
export const getAudioForSpeechGeneration = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: nullable(
    v.object({
      script: v.string(),
      voiceId: v.string(),
      voiceSettings: v.optional(voiceSettingsValidator),
      contentHash: v.string(),
      model: audioModelValidator,
    })
  ),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio?.script) {
      return null;
    }

    return {
      script: audio.script,
      voiceId: audio.voiceId,
      voiceSettings: audio.voiceSettings,
      contentHash: audio.contentHash,
      model: audio.model,
    };
  },
});

/**
 * Verify content hash matches expected value.
 * Used by actions to check if content changed during generation.
 */
export const verifyContentHash = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
    expectedHash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      return false;
    }

    return audio.contentHash === args.expectedHash;
  },
});

/**
 * Check if script already exists for an audio record.
 * Used for idempotency - skip generation if already exists.
 */
export const hasScript = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);
    return !!audio?.script;
  },
});

/**
 * Check if audio already exists for an audio record.
 * Used for idempotency - skip generation if already exists.
 */
export const hasAudio = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);
    return !!audio?.audioStorageId;
  },
});
