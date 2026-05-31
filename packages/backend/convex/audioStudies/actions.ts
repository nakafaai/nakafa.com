import { elevenlabs } from "@repo/ai/config/elevenlabs";
import {
  getModelGatewayId,
  getModelProviderOptions,
  ModelIdSchema,
} from "@repo/ai/config/model";
import { gateway } from "@repo/ai/config/provider";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies/v3";
import { internal } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { PCM_FORMAT } from "@repo/backend/convex/audioStudies/constants";
import {
  generateAudioScript,
  generateAudioSpeech,
} from "@repo/backend/convex/audioStudies/generation/impl";
import {
  type AudioGenerationProviders,
  type AudioGenerationStore,
  audioGenerationArgs,
} from "@repo/backend/convex/audioStudies/generation/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { experimental_generateSpeech, generateText } from "ai";
import { v } from "convex/values";

const audioGenerationModel = ModelIdSchema.make("nakafa-pro");

/**
 * Native Convex adapter for audio-generation business logic.
 *
 * The action file keeps external provider and storage calls behind this seam
 * so queries/mutations never import AI SDK provider code.
 *
 * @see https://docs.convex.dev/functions/actions
 */
function createAudioGenerationAdapters(ctx: ActionCtx): {
  providers: AudioGenerationProviders;
  store: AudioGenerationStore;
} {
  return {
    providers: {
      defaultVoiceSettings: getDefaultVoiceSettings(),
      generateScriptText: async (content) => {
        const languageModel = gateway(getModelGatewayId(audioGenerationModel));
        const prompt = podcastScriptPrompt({
          title: content.title,
          description: content.description,
          body: content.body,
          locale: content.locale,
        });

        const { text } = await generateText({
          model: languageModel,
          prompt,
          providerOptions: {
            gateway: gatewayProviderOptions,
            google: getModelProviderOptions(audioGenerationModel),
          },
        });

        return text;
      },
      generateSpeechChunk: async (input) => {
        const result = await experimental_generateSpeech({
          model: elevenlabs.speech(input.model),
          text: input.text,
          voice: input.voiceId,
          outputFormat: PCM_FORMAT.outputFormat,
          providerOptions: {
            elevenlabs: {
              voiceSettings: {
                similarityBoost: input.voiceSettings.similarityBoost,
                stability: input.voiceSettings.stability,
                style: input.voiceSettings.style,
                useSpeakerBoost: input.voiceSettings.useSpeakerBoost,
              },
            },
          },
        });

        return new Uint8Array(result.audio.uint8Array);
      },
      storeAudio: async ({ wavBuffer }) => {
        const audioBytes = new Uint8Array(wavBuffer);
        const audioBlob = new Blob([audioBytes], {
          type: "audio/wav",
        });

        return await ctx.storage.store(audioBlob);
      },
    },
    store: {
      claimScriptGeneration: (contentAudioId) =>
        ctx.runMutation(
          internal.audioStudies.mutations.contentAudios.claimScriptGeneration,
          { contentAudioId }
        ),
      claimSpeechGeneration: (contentAudioId) =>
        ctx.runMutation(
          internal.audioStudies.mutations.contentAudios.claimSpeechGeneration,
          { contentAudioId }
        ),
      markFailed: (input) =>
        ctx.runMutation(
          internal.audioStudies.mutations.contentAudios.markFailed,
          input
        ),
      readScriptGenerationData: (contentAudioId) =>
        ctx.runQuery(
          internal.audioStudies.queries.internal
            .getAudioAndContentForScriptGeneration,
          { contentAudioId }
        ),
      readSpeechGenerationData: (contentAudioId) =>
        ctx.runQuery(
          internal.audioStudies.queries.internal.getAudioForSpeechGeneration,
          { contentAudioId }
        ),
      saveAudio: (input) =>
        ctx.runMutation(
          internal.audioStudies.mutations.contentAudios.saveAudio,
          input
        ),
      saveScript: (input) =>
        ctx.runMutation(
          internal.audioStudies.mutations.contentAudios.saveScript,
          input
        ),
      verifyContentHash: (input) =>
        ctx.runQuery(
          internal.audioStudies.queries.internal.verifyContentHash,
          input
        ),
    },
  };
}

/**
 * Generate a podcast script for content audio.
 * Uses Gemini to create a conversational script with ElevenLabs V3 audio tags.
 *
 * Idempotent: If script already exists, returns immediately without API call.
 * Cost protection: Validates content hash before and after generation.
 */
export const generateScript = internalAction({
  args: audioGenerationArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { providers, store } = createAudioGenerationAdapters(ctx);
    return await runConvexProgram(generateAudioScript(store, providers, args));
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
  args: audioGenerationArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { providers, store } = createAudioGenerationAdapters(ctx);
    return await runConvexProgram(generateAudioSpeech(store, providers, args));
  },
});
