import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";
import { contentIdValidator, contentTypeValidator } from "@repo/backend/convex/audioStudies/schema";

/**
 * Internal: Get content audio metadata by ID.
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
      status: audio.status,
    };
  },
});

/**
 * Internal: Get content audio with script by ID.
 * Used by generateSpeech action to retrieve script for TTS.
 */
export const getWithScriptById = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: nullable(
    v.object({
      script: v.string(),
      voiceId: v.string(),
      voiceSettings: v.optional(voiceSettingsValidator),
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
    };
  },
});
