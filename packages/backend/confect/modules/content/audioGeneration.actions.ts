"use node";

import { createElevenLabsClient } from "@repo/ai/config/elevenlabs";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies/v3";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
} from "@repo/backend/confect/_generated/services";
import {
  calculateDurationFromPCM,
  PCM_FORMAT,
  pcmToWav,
} from "@repo/backend/confect/modules/content/audioGeneration.constants";
import { chunkScript, DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
import {
  experimental_generateSpeech as aiGenerateSpeech,
  generateText,
} from "ai";
import { Effect, Schema } from "effect";

export class AudioGenerationActionError extends Schema.TaggedError<AudioGenerationActionError>()(
  "AudioGenerationActionError",
  { message: Schema.String }
) {}

/** Converts an unknown failure into a readable queue error message. */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Fails when content changed while paid generation work was running. */
function failContentChanged(message: string) {
  return Effect.fail(new AudioGenerationActionError({ message }));
}

/** Generates and stores a podcast script for one content audio row. */
export const generateScript = Effect.fn("audioGeneration.generateScript")(
  (args: { contentAudioId: Id<"contentAudios"> }) =>
    Effect.gen(function* () {
      const mutations = yield* MutationRunner;
      const queries = yield* QueryRunner;
      yield* Effect.logInfo("Generating audio script.", args);

      const claimed = yield* mutations(
        refs.internal.audioStudies.mutations.contentAudios
          .claimScriptGeneration,
        args
      );

      if (!claimed) {
        yield* Effect.logInfo(
          "Audio script generation was already claimed.",
          args
        );
        return null;
      }

      const program = Effect.gen(function* () {
        const data = yield* queries(
          refs.internal.audioStudies.queries.internalFunctions
            .getAudioAndContentForScriptGeneration,
          args
        );

        if (!data) {
          return yield* Effect.fail(
            new AudioGenerationActionError({
              message: "Audio or content not found.",
            })
          );
        }

        const { contentAudio, content } = data;
        const hashValidBefore = yield* queries(
          refs.internal.audioStudies.queries.internalFunctions
            .verifyContentHash,
          {
            contentAudioId: args.contentAudioId,
            expectedHash: contentAudio.contentHash,
          }
        );

        if (!hashValidBefore) {
          return yield* failContentChanged(
            "Content changed during generation, aborting to save costs."
          );
        }

        const prompt = podcastScriptPrompt({
          body: content.body,
          description: content.description,
          locale: content.locale,
          title: content.title,
        });
        const { text: script } = yield* Effect.tryPromise(() =>
          generateText({
            model: model.languageModel("nakafa-pro"),
            prompt,
            providerOptions: {
              gateway: gatewayProviderOptions,
              google: getModelProviderOptions("nakafa-pro"),
            },
          })
        );
        const hashValidAfter = yield* queries(
          refs.internal.audioStudies.queries.internalFunctions
            .verifyContentHash,
          {
            contentAudioId: args.contentAudioId,
            expectedHash: contentAudio.contentHash,
          }
        );

        if (!hashValidAfter) {
          return yield* failContentChanged(
            "Content changed after generation, discarding result to save costs."
          );
        }

        yield* mutations(
          refs.internal.audioStudies.mutations.contentAudios.saveScript,
          {
            contentAudioId: args.contentAudioId,
            script,
          }
        );

        yield* Effect.logInfo("Audio script saved.", {
          contentAudioId: args.contentAudioId,
          scriptLength: script.length,
        });
        return null;
      });

      return yield* program.pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError("Audio script generation failed.", {
              contentAudioId: args.contentAudioId,
              error: getErrorMessage(error),
            });
            yield* mutations(
              refs.internal.audioStudies.mutations.contentAudios.markFailed,
              {
                contentAudioId: args.contentAudioId,
                error: getErrorMessage(error),
              }
            );
            return yield* Effect.fail(error);
          })
        )
      );
    })
);

/** Generates speech audio for one scripted content audio row. */
export const generateSpeech = Effect.fn("audioGeneration.generateSpeech")(
  (args: { contentAudioId: Id<"contentAudios"> }) =>
    Effect.gen(function* () {
      const mutations = yield* MutationRunner;
      const queries = yield* QueryRunner;
      const storage = yield* StorageActionWriter;
      yield* Effect.logInfo("Generating speech audio.", args);

      const claimed = yield* mutations(
        refs.internal.audioStudies.mutations.contentAudios
          .claimSpeechGeneration,
        args
      );

      if (!claimed) {
        yield* Effect.logInfo("Speech generation was already claimed.", args);
        return null;
      }

      const program = Effect.gen(function* () {
        const audio = yield* queries(
          refs.internal.audioStudies.queries.internalFunctions
            .getAudioForSpeechGeneration,
          args
        );

        if (!audio) {
          return yield* Effect.fail(
            new AudioGenerationActionError({
              message: "No script found for audio generation.",
            })
          );
        }

        const hashStillValid = yield* queries(
          refs.internal.audioStudies.queries.internalFunctions
            .verifyContentHash,
          {
            contentAudioId: args.contentAudioId,
            expectedHash: audio.contentHash,
          }
        );

        if (!hashStillValid) {
          return yield* failContentChanged(
            "Content changed before speech generation, aborting to save costs."
          );
        }

        const chunks = chunkScript(audio.script, DEFAULT_CHUNK_CONFIG);
        const firstChunk = chunks[0];

        if (!firstChunk) {
          return yield* Effect.fail(
            new AudioGenerationActionError({
              message:
                "Script chunking returned no content for speech generation.",
            })
          );
        }

        const voiceSettings = audio.voiceSettings ?? getDefaultVoiceSettings();
        const providerVoiceSettings = {
          similarityBoost: voiceSettings.similarityBoost,
          stability: voiceSettings.stability,
          style: voiceSettings.style,
          useSpeakerBoost: voiceSettings.useSpeakerBoost,
        };
        const elevenlabs = createElevenLabsClient();
        const firstResult = yield* Effect.tryPromise(() =>
          aiGenerateSpeech({
            model: elevenlabs.speech(audio.model),
            outputFormat: PCM_FORMAT.outputFormat,
            providerOptions: {
              elevenlabs: { voiceSettings: providerVoiceSettings },
            },
            text: firstChunk.text,
            voice: audio.voiceId,
          })
        );
        const audioBuffers = [new Uint8Array(firstResult.audio.uint8Array)];

        for (const [index, chunk] of chunks.slice(1).entries()) {
          yield* Effect.logInfo("Generating speech chunk.", {
            chunkIndex: index + 2,
            contentAudioId: args.contentAudioId,
            totalChunks: chunks.length,
          });
          const result = yield* Effect.tryPromise(() =>
            aiGenerateSpeech({
              model: elevenlabs.speech(audio.model),
              outputFormat: PCM_FORMAT.outputFormat,
              providerOptions: {
                elevenlabs: { voiceSettings: providerVoiceSettings },
              },
              text: chunk.text,
              voice: audio.voiceId,
            })
          );
          audioBuffers.push(new Uint8Array(result.audio.uint8Array));
        }

        const totalLength = audioBuffers.reduce(
          (sum, buffer) => sum + buffer.length,
          0
        );
        const pcmBuffer = new Uint8Array(totalLength);
        let offset = 0;

        for (const buffer of audioBuffers) {
          pcmBuffer.set(buffer, offset);
          offset += buffer.length;
        }

        const duration = calculateDurationFromPCM(pcmBuffer.length);
        const hashValidAfter = yield* queries(
          refs.internal.audioStudies.queries.internalFunctions
            .verifyContentHash,
          {
            contentAudioId: args.contentAudioId,
            expectedHash: audio.contentHash,
          }
        );

        if (!hashValidAfter) {
          return yield* failContentChanged(
            "Content changed after speech generation, discarding to save costs."
          );
        }

        const wavBuffer = pcmToWav(pcmBuffer);
        const audioBlob = new Blob([Buffer.from(wavBuffer)], {
          type: "audio/wav",
        });
        const storageId = yield* storage.store(audioBlob);

        yield* mutations(
          refs.internal.audioStudies.mutations.contentAudios.saveAudio,
          {
            contentAudioId: args.contentAudioId,
            duration,
            size: wavBuffer.byteLength,
            storageId,
          }
        );

        yield* Effect.logInfo("Speech audio saved.", {
          contentAudioId: args.contentAudioId,
          duration,
          size: wavBuffer.byteLength,
          storageId,
        });
        return null;
      });

      return yield* program.pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError("Speech generation failed.", {
              contentAudioId: args.contentAudioId,
              error: getErrorMessage(error),
            });
            yield* mutations(
              refs.internal.audioStudies.mutations.contentAudios.markFailed,
              {
                contentAudioId: args.contentAudioId,
                error: getErrorMessage(error),
              }
            );
            return yield* Effect.fail(error);
          })
        )
      );
    })
);
