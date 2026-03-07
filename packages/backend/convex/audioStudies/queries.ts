import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  fetchContentForAudio,
  getContentHash as getContentHashHelper,
  getContentRefBySlugAndLocale as getContentRefBySlugAndLocaleHelper,
  getContentSlug as getContentSlugHelper,
} from "@repo/backend/convex/audioStudies/utils";
import {
  audioContentRefValidator,
  audioModelValidator,
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
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

    // Fetch content using discriminated union
    // TypeScript automatically narrows the type - no assertions needed
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
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio) {
      return false;
    }

    return audio.contentHash === args.expectedHash;
  },
});

/**
 * Get content hash for a content item by type and ID.
 * Used by workflow to fetch hash before creating audio record.
 * Returns null if content not found.
 *
 * Type Safety:
 * - Uses discriminated union (contentRef) for type-safe lookups
 * - TypeScript automatically narrows the id type based on the type discriminator
 * - No type assertions needed - clean TypeScript like JavaScript
 */
export const getContentHash = internalQuery({
  args: {
    contentRef: audioContentRefValidator,
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) => getContentHashHelper(ctx, args.contentRef),
});

/**
 * Get content slug by type and ID.
 * Used to find content in different locales.
 * Returns null if content not found.
 */
export const getContentSlug = internalQuery({
  args: {
    contentRef: audioContentRefValidator,
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) => getContentSlugHelper(ctx, args.contentRef),
});

/**
 * Verifies audio file exists in storage.
 */
export const verifyAudioFileExists = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get("contentAudios", args.contentAudioId);

    if (!audio?.audioStorageId) {
      return false;
    }

    try {
      await ctx.storage.getUrl(audio.audioStorageId);
      return true;
    } catch {
      return false;
    }
  },
});

/**
 * Gets content reference by slug and locale for cross-locale lookups.
 */
export const getContentRefBySlugAndLocale = internalQuery({
  args: {
    contentRef: audioContentRefValidator,
    locale: localeValidator,
  },
  returns: nullable(audioContentRefValidator),
  handler: async (ctx, args) =>
    getContentRefBySlugAndLocaleHelper(ctx, args.contentRef, args.locale),
});
