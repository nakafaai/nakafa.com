import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  scriptGenerationDataValidator,
  speechGenerationDataValidator,
} from "@repo/backend/convex/audioStudies/generation/spec";
import { getAudioContentSourceByGraphContentId } from "@repo/backend/convex/audioStudies/helpers/sources";
import { graphContentIdValidator } from "@repo/backend/convex/contents/graph";
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
      alignmentId: audio.alignmentId,
      assetId: audio.assetId,
      conceptId: audio.conceptId,
      contentHash: audio.contentHash,
      content_id: audio.content_id,
      contentType: audio.contentType,
      learningObjectId: audio.learningObjectId,
      lensId: audio.lensId,
      locale: audio.locale,
      route: audio.route,
      voiceId: audio.voiceId,
      voiceSettings: audio.voiceSettings,
      status: audio.status,
    };

    if (audio.contentType === "article") {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", audio.locale).eq("slug", audio.route)
        )
        .unique();

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

    const section = await ctx.db
      .query("subjectSections")
      .withIndex("by_locale_and_slug", (q) =>
        q.eq("locale", audio.locale).eq("slug", audio.route)
      )
      .unique();

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
    content_id: graphContentIdValidator,
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) =>
    (await getAudioContentSourceByGraphContentId(ctx, args.content_id))
      ?.contentHash ?? null,
});
