"use node";

import { elevenlabs } from "@repo/ai/config/elevenlabs";
import { model } from "@repo/ai/config/vercel";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies/v3";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  SECONDS_PER_MINUTE,
  WORD_SPLIT_REGEX,
  WORDS_PER_MINUTE,
} from "@repo/backend/convex/audioStudies/constants";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getErrorMessage } from "@repo/backend/convex/utils/helper";
import { logger } from "@repo/backend/convex/utils/logger";
import { chunkScript, DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
import {
  experimental_generateSpeech as aiGenerateSpeech,
  generateText,
} from "ai";
import { ConvexError, v } from "convex/values";

/**
 * Generate a podcast script for content audio.
 * Uses Gemini to create a conversational script with ElevenLabs V3 audio tags.
 *
 * Idempotent: If script already exists, returns immediately without API call.
 * Cost protection: Validates content hash before and after generation.
 */
export const generateScript = internalAction({
  args: { contentAudioId: vv.id("contentAudios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    logger.info("Generating script", { contentAudioId: args.contentAudioId });

    const claimed = await ctx.runMutation(
      internal.audioStudies.mutations.claimScriptGeneration,
      { contentAudioId: args.contentAudioId }
    );

    if (!claimed) {
      logger.info("Script already claimed or generated", {
        contentAudioId: args.contentAudioId,
      });
      return null;
    }

    logger.info("Script generation claimed", {
      contentAudioId: args.contentAudioId,
    });

    try {
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

      const hashValidBefore = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: contentAudio.contentHash,
        }
      );

      if (!hashValidBefore) {
        logger.warn("Content changed before script generation", {
          contentAudioId: args.contentAudioId,
          contentHash: contentAudio.contentHash,
        });
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message: "Content changed during generation, aborting to save costs",
        });
      }

      logger.info("Generating script with AI", {
        contentAudioId: args.contentAudioId,
        contentType: contentAudio.contentRef.type,
      });

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

      logger.info("Script generated", {
        contentAudioId: args.contentAudioId,
        scriptLength: script.length,
      });

      const hashValidAfter = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: contentAudio.contentHash,
        }
      );

      if (!hashValidAfter) {
        logger.warn("Content changed after script generation", {
          contentAudioId: args.contentAudioId,
          contentHash: contentAudio.contentHash,
        });
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

      logger.info("Script saved", { contentAudioId: args.contentAudioId });
    } catch (error) {
      logger.error(
        "Script generation failed",
        { contentAudioId: args.contentAudioId },
        error
      );
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
 * Generate speech from a script using ElevenLabs V3 with automatic chunking.
 *
 * V3 has a 5,000 character limit per request. To handle longer scripts:
 * 1. Split script into chunks at natural boundaries (paragraphs/sentences)
 * 2. Generate audio for each chunk sequentially
 * 3. Combine all audio buffers into a single file
 *
 * Idempotent: If audio already exists, returns immediately without API call.
 * Cost protection: Validates content hash before expensive ElevenLabs API call.
 *
 * Note: V3 does NOT support previous_text/next_text context parameters.
 * Continuity is achieved through the audio tags in the script itself.
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */
export const generateSpeech = internalAction({
  args: { contentAudioId: vv.id("contentAudios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    logger.info("Generating speech", { contentAudioId: args.contentAudioId });

    const claimed = await ctx.runMutation(
      internal.audioStudies.mutations.claimSpeechGeneration,
      { contentAudioId: args.contentAudioId }
    );

    if (!claimed) {
      logger.info("Speech already claimed or generated", {
        contentAudioId: args.contentAudioId,
      });
      return null;
    }

    logger.info("Speech generation claimed", {
      contentAudioId: args.contentAudioId,
    });

    try {
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

      const hashStillValid = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: audio.contentHash,
        }
      );

      if (!hashStillValid) {
        logger.warn("Content changed before speech generation", {
          contentAudioId: args.contentAudioId,
          contentHash: audio.contentHash,
        });
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message:
            "Content changed before speech generation, aborting to save costs",
        });
      }

      const chunks = chunkScript(audio.script, DEFAULT_CHUNK_CONFIG);

      logger.info("Generating speech with ElevenLabs", {
        contentAudioId: args.contentAudioId,
        chunkCount: chunks.length,
        scriptLength: audio.script.length,
      });

      const audioBuffers: Uint8Array[] = [];
      const voiceSettings = audio.voiceSettings ?? getDefaultVoiceSettings();

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.info(`Generating speech chunk ${i + 1}/${chunks.length}`, {
          contentAudioId: args.contentAudioId,
          chunkIndex: i + 1,
          totalChunks: chunks.length,
        });

        const result = await aiGenerateSpeech({
          model: elevenlabs.speech(audio.model),
          text: chunk.text,
          voice: audio.voiceId,
          outputFormat: "mp3_44100_192",
          providerOptions: {
            elevenlabs: {
              voiceSettings,
            },
          },
        });

        audioBuffers.push(new Uint8Array(result.audio.uint8Array));
      }

      logger.info("All speech chunks generated", {
        contentAudioId: args.contentAudioId,
        chunkCount: chunks.length,
      });

      const totalLength = audioBuffers.reduce(
        (sum, buf) => sum + buf.length,
        0
      );
      const combinedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of audioBuffers) {
        combinedBuffer.set(buffer, offset);
        offset += buffer.length;
      }

      const hashValidAfter = await ctx.runQuery(
        internal.audioStudies.queries.verifyContentHash,
        {
          contentAudioId: args.contentAudioId,
          expectedHash: audio.contentHash,
        }
      );

      if (!hashValidAfter) {
        logger.warn("Content changed after speech generation", {
          contentAudioId: args.contentAudioId,
          contentHash: audio.contentHash,
        });
        throw new ConvexError({
          code: "CONTENT_CHANGED",
          message:
            "Content changed after speech generation, discarding to save costs",
        });
      }

      const audioBlob = new Blob([combinedBuffer], {
        type: "audio/mpeg",
      });
      const storageId = await ctx.storage.store(audioBlob);

      const scriptWithoutTags = audio.script.replace(/\[[^\]]+\]/g, "");
      const wordCount = scriptWithoutTags
        .trim()
        .split(WORD_SPLIT_REGEX)
        .filter(Boolean).length;
      const duration = Math.ceil(
        (wordCount / WORDS_PER_MINUTE) * SECONDS_PER_MINUTE
      );

      await ctx.runMutation(internal.audioStudies.mutations.saveAudio, {
        contentAudioId: args.contentAudioId,
        storageId,
        duration,
        size: combinedBuffer.byteLength,
      });

      logger.info("Speech saved", {
        contentAudioId: args.contentAudioId,
        storageId,
        duration,
        size: combinedBuffer.byteLength,
      });
    } catch (error) {
      logger.error(
        "Speech generation failed",
        { contentAudioId: args.contentAudioId },
        error
      );
      await ctx.runMutation(internal.audioStudies.mutations.markFailed, {
        contentAudioId: args.contentAudioId,
        error: getErrorMessage(error),
      });
      throw error;
    }

    return null;
  },
});
