"use node";

import { elevenlabs } from "@repo/ai/config/elevenlabs";
import { model } from "@repo/ai/config/vercel";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import type {
  ContentId,
  ContentType,
} from "@repo/backend/convex/audioStudies/schema";
import { vv } from "@repo/backend/convex/lib/validators";
import { getErrorMessage } from "@repo/backend/convex/utils/helper";
import {
  experimental_generateSpeech as aiGenerateSpeech,
  generateText,
} from "ai";
import { ConvexError, v } from "convex/values";

/**
 * Regex for splitting text into words for word count estimation.
 * Defined at top level for performance.
 */
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Generate a podcast script for content audio.
 * Uses Gemini to create a conversational script with ElevenLabs V3 audio tags.
 */
export const generateScript = internalAction({
  args: { contentAudioId: vv.id("contentAudios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.runQuery(internal.audioStudies.queries.getById, {
      contentAudioId: args.contentAudioId,
    });

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio not found",
      });
    }

    await ctx.runMutation(internal.audioStudies.mutations.updateStatus, {
      contentAudioId: args.contentAudioId,
      status: "generating-script",
    });

    try {
      const content = await fetchContent(
        ctx,
        audio.contentId,
        audio.contentType
      );

      // Verify content hasn't changed before generating (save money)
      const hashStillValid = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: audio.contentHash,
        }
      );

      if (!hashStillValid) {
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message: "Content changed during generation, aborting to save costs",
        });
      }

      const prompt = podcastScriptPrompt({
        title: content.title,
        description: content.description,
        body: content.body,
        locale: content.locale,
      });

      const { text: script } = await generateText({
        model: model.languageModel("gemini-3-flash"),
        prompt,
      });

      // Double-check hash hasn't changed before saving
      const hashStillValidAfter = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: audio.contentHash,
        }
      );

      if (!hashStillValidAfter) {
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message:
            "Content changed after generation, discarding result to save costs",
        });
      }

      await ctx.runMutation(internal.audioStudies.mutations.saveScript, {
        contentAudioId: args.contentAudioId,
        script,
      });
    } catch (error) {
      await ctx.runMutation(internal.audioStudies.mutations.markFailed, {
        contentAudioId: args.contentAudioId,
        error: getErrorMessage(error),
      });
      throw error;
    }

    return null;
  },
});

/**
 * Generate speech from a script using ElevenLabs.
 * Stores the audio file in Convex storage.
 */
export const generateSpeech = internalAction({
  args: { contentAudioId: vv.id("contentAudios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.runQuery(
      internal.audioStudies.queries.getWithScriptById,
      { contentAudioId: args.contentAudioId }
    );

    if (!audio?.script) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "No script found for audio generation",
      });
    }

    await ctx.runMutation(internal.audioStudies.mutations.updateStatus, {
      contentAudioId: args.contentAudioId,
      status: "generating-speech",
    });

    try {
      // Get the audio record to check current hash
      const audioRecord = await ctx.runQuery(
        internal.audioStudies.queries.getById,
        { contentAudioId: args.contentAudioId }
      );

      if (!audioRecord) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Audio record not found",
        });
      }

      // Generate speech using ElevenLabs V3 via AI SDK
      // V3 supports audio tags ([curious], [excited], etc.) for rich emotions
      const result = await aiGenerateSpeech({
        model: elevenlabs.speech("eleven_v3"),
        text: audio.script,
        voice: audio.voiceId,
        providerOptions: {
          elevenlabs: {
            voiceSettings: audio.voiceSettings ?? getDefaultVoiceSettings(),
          },
        },
      });

      // Verify hash hasn't changed before saving (ElevenLabs costs money!)
      const hashStillValid = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: audioRecord.contentHash,
        }
      );

      if (!hashStillValid) {
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message:
            "Content changed after speech generation, discarding to save costs",
        });
      }

      const audioBlob = new Blob([new Uint8Array(result.audio.uint8Array)], {
        type: result.audio.mediaType,
      });
      const storageId = await ctx.storage.store(audioBlob);
      const wordCount = audio.script
        .trim()
        .split(WORD_SPLIT_REGEX)
        .filter(Boolean).length;
      const duration = Math.ceil((wordCount / 150) * 60);

      await ctx.runMutation(internal.audioStudies.mutations.saveAudio, {
        contentAudioId: args.contentAudioId,
        storageId,
        duration,
        size: result.audio.uint8Array.byteLength,
      });
    } catch (error) {
      await ctx.runMutation(internal.audioStudies.mutations.markFailed, {
        contentAudioId: args.contentAudioId,
        error: getErrorMessage(error),
      });
      throw error;
    }

    return null;
  },
});

/**
 * Fetch content (article or subject section) by ID.
 */
async function fetchContent(ctx: ActionCtx, id: ContentId, type: ContentType) {
  if (type === "article") {
    const article = await ctx.runQuery(
      internal.articleContents.queries.getById,
      {
        id: id as Id<"articleContents">,
      }
    );

    if (!article) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Article not found",
      });
    }

    return article;
  }

  const section = await ctx.runQuery(internal.subjectSections.queries.getById, {
    id: id as Id<"subjectSections">,
  });

  if (!section) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Section not found",
    });
  }

  return section;
}
