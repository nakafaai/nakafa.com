import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  fetchContentForAudio,
  fetchContentHash,
} from "@repo/backend/convex/audioStudies/utils";
import {
  audioContentRefValidator,
  audioModelValidator,
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

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
        contentRef: audioContentRefValidator,
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
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      return null;
    }

    const content = await fetchContentForAudio(ctx, audio.contentRef);

    if (!content) {
      return null;
    }

    return {
      contentAudio: {
        contentRef: audio.contentRef,
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
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

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

/** Verify content hash matches expected value for a queued audio job. */
export const verifyContentHash = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
    expectedHash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      return false;
    }

    return audio.contentHash === args.expectedHash;
  },
});

/** Get content hash for a content item by type and ID. */
export const getContentHash = internalQuery({
  args: {
    contentRef: audioContentRefValidator,
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) => fetchContentHash(ctx, args.contentRef),
});
