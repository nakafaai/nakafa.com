import { createElevenLabsClient } from "@repo/ai/config/elevenlabs";
import { getDefaultVoiceSettings } from "@repo/ai/config/voices";
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
import {
  AudioGenerationActionError,
  failContentChanged,
  getErrorMessage,
} from "@repo/backend/confect/modules/content/audioGeneration.errors";
import { chunkScript, DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
import { experimental_generateSpeech } from "ai";
import { Effect } from "effect";

/** Generates speech audio for one scripted content audio row. */
export const generateSpeech = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
}) {
  const mutations = yield* MutationRunner;
  const queries = yield* QueryRunner;
  const storage = yield* StorageActionWriter;
  yield* Effect.logInfo("Generating speech audio.", args);

  const claimed = yield* mutations(
    refs.internal.audioStudies.mutations.contentAudios.claimSpeechGeneration,
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
      refs.internal.audioStudies.queries.internalFunctions.verifyContentHash,
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
          message: "Script chunking returned no content for speech generation.",
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
      experimental_generateSpeech({
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
        experimental_generateSpeech({
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
      refs.internal.audioStudies.queries.internalFunctions.verifyContentHash,
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
    const audioBlob = new Blob([wavBuffer], {
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
});
