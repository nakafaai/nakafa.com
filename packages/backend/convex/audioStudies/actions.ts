"use node";

import { elevenlabs } from "@repo/ai/config/elevenlabs";
import { model } from "@repo/ai/config/vercel";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
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
 * Fetches content and audio metadata in a single query for efficiency.
 */
export const generateScript = internalAction({
  args: { contentAudioId: vv.id("contentAudios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Consolidated: Get audio + content in single query (was 3 separate calls)
    const data = await ctx.runQuery(
      internal.audioStudies.queries.getAudioAndContentForScriptGeneration,
      { contentAudioId: args.contentAudioId }
    );

    if (!data) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio or content not found",
      });
    }

    const { contentAudio, content } = data;

    // Update status: generating-script
    await ctx.runMutation(internal.audioStudies.mutations.updateStatus, {
      contentAudioId: args.contentAudioId,
      status: "generating-script",
    });

    try {
      // Verify content hash inline (no extra query call)
      // Hash verification is done by fetching fresh data from DB
      const currentAudio = await ctx.runQuery(
        internal.audioStudies.queries.getById,
        { contentAudioId: args.contentAudioId }
      );

      if (
        !currentAudio ||
        currentAudio.contentHash !== contentAudio.contentHash
      ) {
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

      // Verify hash hasn't changed after generation
      const audioAfter = await ctx.runQuery(
        internal.audioStudies.queries.getById,
        { contentAudioId: args.contentAudioId }
      );

      if (!audioAfter || audioAfter.contentHash !== contentAudio.contentHash) {
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message:
            "Content changed after generation, discarding result to save costs",
        });
      }

      // Consolidated: Save script + update status in one mutation
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
 * Retrieves script and audio configuration in a single query for efficiency.
 */
export const generateSpeech = internalAction({
  args: { contentAudioId: vv.id("contentAudios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Consolidated: Get audio with script + hash in single query
    const audio = await ctx.runQuery(
      internal.audioStudies.queries.getAudioForSpeechGeneration,
      { contentAudioId: args.contentAudioId }
    );

    if (!audio) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "No script found for audio generation",
      });
    }

    // Update status: generating-speech
    await ctx.runMutation(internal.audioStudies.mutations.updateStatus, {
      contentAudioId: args.contentAudioId,
      status: "generating-speech",
    });

    try {
      // Generate speech using ElevenLabs V3 via AI SDK
      // CRITICAL: V3 only supports 'stability' parameter!
      // Other settings (similarityBoost, style, useSpeakerBoost) cause 400 Bad Request
      const voiceSettings = audio.voiceSettings ?? getDefaultVoiceSettings();

      const result = await aiGenerateSpeech({
        model: elevenlabs.speech("eleven_v3"),
        text: audio.script,
        voice: audio.voiceId,
        providerOptions: {
          elevenlabs: {
            // V3 only accepts stability parameter - filter out V2-only settings
            voiceSettings: {
              stability: voiceSettings.stability ?? 0.0,
            },
          },
        },
      });

      // Verify hash hasn't changed before saving
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

      // Consolidated: Save audio metadata + update status in one mutation
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
