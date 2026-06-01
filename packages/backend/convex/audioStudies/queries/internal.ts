import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  scriptGenerationDataValidator,
  speechGenerationDataValidator,
} from "@repo/backend/convex/audioStudies/generation/spec";
import { getAudioContentSourceByRef } from "@repo/backend/convex/audioStudies/helpers/sources";
import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
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
  returns: scriptGenerationDataValidator,
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      return null;
    }

    const contentAudio = {
      contentRef: audio.contentRef,
      contentHash: audio.contentHash,
      voiceId: audio.voiceId,
      voiceSettings: audio.voiceSettings,
      status: audio.status,
    };

    if (audio.contentRef.type === "article") {
      const article = await ctx.db.get("articleContents", audio.contentRef.id);

      if (!article) {
        return null;
      }

      return {
        contentAudio,
        content: {
          title: article.title,
          description: article.description,
          body: article.body,
          locale: article.locale,
        },
      };
    }

    const section = await ctx.db.get("subjectSections", audio.contentRef.id);

    if (!section) {
      return null;
    }

    return {
      contentAudio,
      content: {
        title: section.title,
        description: section.description,
        body: section.body,
        locale: section.locale,
      },
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
  returns: speechGenerationDataValidator,
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
  handler: async (ctx, args) =>
    (await getAudioContentSourceByRef(ctx, args.contentRef))?.contentHash ??
    null,
});
