"use node";

import { elevenlabs } from "@repo/ai/config/elevenlabs";
import { model } from "@repo/ai/config/vercel";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies/v3";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  calculateDurationFromPCM,
  PCM_FORMAT,
  pcmToWav,
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
 * AUDIO FORMAT STRATEGY:
 * Using PCM 44.1kHz (Pro plan) instead of MP3 for 100% accurate duration:
 * 1. ElevenLabs generates PCM 44.1kHz (CD quality, uncompressed)
 * 2. PCM buffers concatenate safely (no metadata headers to conflict)
 * 3. Duration calculated from exact buffer size: bytes / (44100 × 2)
 * 4. Convert to WAV for browser compatibility with accurate headers
 *
 * WHY NOT MP3?
 * - MP3 chunks each have duration metadata headers
 * - Concatenating MP3 bytes keeps only first chunk's duration header
 * - Results in incorrect duration (e.g., 5:46 instead of actual 6:58)
 * - VBR (Variable Bit Rate) MP3 duration estimation is inherently inaccurate
 *
 * V3 has a 5,000 character limit per request. To handle longer scripts:
 * 1. Split script into chunks at natural boundaries (paragraphs/sentences)
 * 2. Generate audio for each chunk sequentially using PCM 44.1kHz
 * 3. Concatenate PCM buffers (safe - no metadata conflicts)
 * 4. Convert to WAV with proper duration headers
 *
 * Idempotent: If audio already exists, returns immediately without API call.
 * Cost protection: Validates content hash before expensive ElevenLabs API call.
 *
 * Note: V3 does NOT support previous_text/next_text context parameters.
 * Continuity is achieved through the audio tags in the script itself.
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert#query-parameters
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
          outputFormat: PCM_FORMAT.outputFormat,
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

      // Concatenate PCM buffers (PCM has no metadata headers, just raw samples)
      const totalLength = audioBuffers.reduce(
        (sum, buf) => sum + buf.length,
        0
      );
      const pcmBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of audioBuffers) {
        pcmBuffer.set(buffer, offset);
        offset += buffer.length;
      }

      // Calculate exact duration from PCM buffer size
      // PCM 16-bit 16kHz mono: duration = bufferLength / (sampleRate * bytesPerSample)
      const duration = Math.ceil(calculateDurationFromPCM(pcmBuffer.length));

      logger.info("PCM audio concatenated", {
        contentAudioId: args.contentAudioId,
        pcmBufferLength: pcmBuffer.length,
        calculatedDuration: duration,
      });

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

      // Convert PCM to WAV format with proper duration metadata
      const wavBuffer = pcmToWav(pcmBuffer);
      const audioBlob = new Blob([Buffer.from(wavBuffer)], {
        type: "audio/wav",
      });
      const storageId = await ctx.storage.store(audioBlob);

      await ctx.runMutation(internal.audioStudies.mutations.saveAudio, {
        contentAudioId: args.contentAudioId,
        storageId,
        duration,
        size: wavBuffer.byteLength,
      });

      logger.info("Speech saved", {
        contentAudioId: args.contentAudioId,
        storageId,
        duration,
        size: wavBuffer.byteLength,
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
