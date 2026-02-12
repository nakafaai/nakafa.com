"use node";

import { elevenlabs } from "@repo/ai/config/elevenlabs";
import { model } from "@repo/ai/config/vercel";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies/v3";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getErrorMessage } from "@repo/backend/convex/utils/helper";
import { chunkScript, DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
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

    await ctx.runMutation(internal.audioStudies.mutations.updateStatus, {
      contentAudioId: args.contentAudioId,
      status: "generating-script",
    });

    try {
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

      // Generate podcast script using V3 optimized prompt
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
 * Generate speech from a script using ElevenLabs V3 with automatic chunking.
 *
 * V3 has a 5,000 character limit per request. To handle longer scripts:
 * 1. Split script into chunks at natural boundaries (paragraphs/sentences)
 * 2. Generate audio for each chunk sequentially
 * 3. Combine all audio buffers into a single file
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

    await ctx.runMutation(
      internal.audioStudies.mutations.startSpeechGeneration,
      {
        contentAudioId: args.contentAudioId,
      }
    );

    try {
      // Use default chunk config from @repo/ai/config/elevenlabs (V3: 5k limit, no context)
      const chunks = chunkScript(audio.script, DEFAULT_CHUNK_CONFIG);
      const audioBuffers: Uint8Array[] = [];
      const voiceSettings = audio.voiceSettings ?? getDefaultVoiceSettings();

      // Generate each chunk sequentially using the stored model
      // Using MP3 192kbps for universal browser compatibility and studio quality
      for (const chunk of chunks) {
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

      // Combine all audio buffers into one
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

      const audioBlob = new Blob([combinedBuffer], {
        type: "audio/mpeg",
      });
      const storageId = await ctx.storage.store(audioBlob);

      // Calculate duration based on word count, excluding audio tags like [excited], [curious]
      const scriptWithoutTags = audio.script.replace(/\[[^\]]+\]/g, "");
      const wordCount = scriptWithoutTags
        .trim()
        .split(WORD_SPLIT_REGEX)
        .filter(Boolean).length;
      const duration = Math.ceil((wordCount / 150) * 60);

      await ctx.runMutation(internal.audioStudies.mutations.saveAudio, {
        contentAudioId: args.contentAudioId,
        storageId,
        duration,
        size: combinedBuffer.byteLength,
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
