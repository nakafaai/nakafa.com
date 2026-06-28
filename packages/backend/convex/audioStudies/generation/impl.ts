import {
  calculateDurationFromPCM,
  PCM_FORMAT,
  pcmToWav,
} from "@repo/backend/convex/audioStudies/constants";
import {
  AudioContentChangedError,
  type AudioGenerationArgs,
  type AudioGenerationError,
  AudioGenerationIoError,
  type AudioGenerationProviders,
  type AudioGenerationStore,
  AudioProviderError,
  AudioScriptEmptyError,
  AudioSourceNotFoundError,
  audioContentChangedCode,
  audioGenerationIoFailedCode,
  audioProviderFailedCode,
  audioScriptEmptyCode,
  audioSourceNotFoundCode,
} from "@repo/backend/convex/audioStudies/generation/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { logger } from "@repo/backend/convex/utils/logger";
import { chunkScript, DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
import { Effect } from "effect";

type ContentAudioId = AudioGenerationArgs["contentAudioId"];

/** Concatenates generated PCM chunks without MP3-style metadata conflicts. */
export function concatenateAudioBuffers(buffers: readonly Uint8Array[]) {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const pcmBuffer = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    pcmBuffer.set(buffer, offset);
    offset += buffer.length;
  }

  return pcmBuffer;
}

/** Converts Convex-side IO failures into the typed generation error channel. */
function ioError(error: unknown) {
  return new AudioGenerationIoError({
    code: audioGenerationIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Converts AI provider failures into the typed generation error channel. */
function providerError(error: unknown) {
  return new AudioProviderError({
    code: audioProviderFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Persists retry metadata for an already-claimed audio generation failure. */
const markFailed = Effect.fn("audioStudies.generation.markFailed")(function* (
  store: AudioGenerationStore,
  contentAudioId: ContentAudioId,
  error: AudioGenerationError
) {
  yield* Effect.sync(() =>
    logger.error("Audio generation failed", { contentAudioId }, error)
  );

  yield* Effect.tryPromise({
    try: () => store.markFailed({ contentAudioId, error: error.message }),
    catch: ioError,
  });
});

/** Fails fast when source content changed during an expensive provider call. */
const verifyContentHash = Effect.fn(
  "audioStudies.generation.verifyContentHash"
)(function* (
  store: AudioGenerationStore,
  input: {
    readonly contentAudioId: ContentAudioId;
    readonly errorMessage: string;
    readonly expectedHash: string;
    readonly logMessage: string;
  }
) {
  const hashStillValid = yield* Effect.tryPromise({
    try: () =>
      store.verifyContentHash({
        contentAudioId: input.contentAudioId,
        expectedHash: input.expectedHash,
      }),
    catch: ioError,
  });

  if (hashStillValid) {
    return;
  }

  yield* Effect.sync(() =>
    logger.warn(input.logMessage, {
      contentAudioId: input.contentAudioId,
      contentHash: input.expectedHash,
    })
  );

  return yield* Effect.fail(
    new AudioContentChangedError({
      code: audioContentChangedCode,
      message: input.errorMessage,
    })
  );
});

/** Runs the provider and persistence steps after script generation is claimed. */
const runClaimedScriptGeneration = Effect.fn(
  "audioStudies.generation.runClaimedScriptGeneration"
)(function* (
  store: AudioGenerationStore,
  providers: AudioGenerationProviders,
  contentAudioId: ContentAudioId
) {
  const data = yield* Effect.tryPromise({
    try: () => store.readScriptGenerationData(contentAudioId),
    catch: ioError,
  });

  if (!data) {
    return yield* Effect.fail(
      new AudioSourceNotFoundError({
        code: audioSourceNotFoundCode,
        message: "Audio or content not found",
      })
    );
  }

  yield* verifyContentHash(store, {
    contentAudioId,
    errorMessage: "Content changed during generation, aborting to save costs",
    expectedHash: data.contentAudio.contentHash,
    logMessage: "Content changed before script generation",
  });

  yield* Effect.sync(() =>
    logger.info("Generating script with AI", {
      contentAudioId,
      contentType: data.contentAudio.contentType,
    })
  );

  const script = yield* Effect.tryPromise({
    try: () => providers.generateScriptText(data.content),
    catch: providerError,
  });

  yield* Effect.sync(() =>
    logger.info("Script generated", {
      contentAudioId,
      scriptLength: script.length,
    })
  );

  yield* verifyContentHash(store, {
    contentAudioId,
    errorMessage:
      "Content changed after generation, discarding result to save costs",
    expectedHash: data.contentAudio.contentHash,
    logMessage: "Content changed after script generation",
  });

  yield* Effect.tryPromise({
    try: () => store.saveScript({ contentAudioId, script }),
    catch: ioError,
  });

  yield* Effect.sync(() => logger.info("Script saved", { contentAudioId }));

  return null;
});

/** Generates and persists the podcast script for one claimed audio row. */
export const generateAudioScript = Effect.fn(
  "audioStudies.generation.generateAudioScript"
)(function* (
  store: AudioGenerationStore,
  providers: AudioGenerationProviders,
  args: AudioGenerationArgs
) {
  yield* Effect.sync(() =>
    logger.info("Generating script", { contentAudioId: args.contentAudioId })
  );

  const claimed = yield* Effect.tryPromise({
    try: () => store.claimScriptGeneration(args.contentAudioId),
    catch: ioError,
  });

  if (!claimed) {
    yield* Effect.sync(() =>
      logger.info("Script already claimed or generated", {
        contentAudioId: args.contentAudioId,
      })
    );
    return null;
  }

  yield* Effect.sync(() =>
    logger.info("Script generation claimed", {
      contentAudioId: args.contentAudioId,
    })
  );

  return yield* runClaimedScriptGeneration(
    store,
    providers,
    args.contentAudioId
  ).pipe(
    Effect.tapError((error) => markFailed(store, args.contentAudioId, error))
  );
});

/** Runs chunked speech generation after the audio row is claimed. */
const runClaimedSpeechGeneration = Effect.fn(
  "audioStudies.generation.runClaimedSpeechGeneration"
)(function* (
  store: AudioGenerationStore,
  providers: AudioGenerationProviders,
  contentAudioId: ContentAudioId
) {
  const audio = yield* Effect.tryPromise({
    try: () => store.readSpeechGenerationData(contentAudioId),
    catch: ioError,
  });

  if (!audio) {
    return yield* Effect.fail(
      new AudioSourceNotFoundError({
        code: audioSourceNotFoundCode,
        message: "No script found for audio generation",
      })
    );
  }

  yield* verifyContentHash(store, {
    contentAudioId,
    errorMessage:
      "Content changed before speech generation, aborting to save costs",
    expectedHash: audio.contentHash,
    logMessage: "Content changed before speech generation",
  });

  const chunks = chunkScript(audio.script, DEFAULT_CHUNK_CONFIG);

  if (chunks.length === 0) {
    return yield* Effect.fail(
      new AudioScriptEmptyError({
        code: audioScriptEmptyCode,
        message: "Script chunking returned no content for speech generation.",
      })
    );
  }

  yield* Effect.sync(() =>
    logger.info("Generating speech with ElevenLabs", {
      contentAudioId,
      chunkCount: chunks.length,
      outputFormat: PCM_FORMAT.outputFormat,
      scriptLength: audio.script.length,
    })
  );

  const voiceSettings = audio.voiceSettings ?? providers.defaultVoiceSettings;
  const audioBuffers: Uint8Array[] = [];

  for (const [index, chunk] of chunks.entries()) {
    yield* Effect.sync(() =>
      logger.info(`Generating speech chunk ${index + 1}/${chunks.length}`, {
        contentAudioId,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
      })
    );

    const audioBuffer = yield* Effect.tryPromise({
      try: () =>
        providers.generateSpeechChunk({
          model: audio.model,
          text: chunk.text,
          voiceId: audio.voiceId,
          voiceSettings,
        }),
      catch: providerError,
    });

    audioBuffers.push(audioBuffer);
  }

  yield* Effect.sync(() =>
    logger.info("All speech chunks generated", {
      contentAudioId,
      chunkCount: chunks.length,
    })
  );

  const pcmBuffer = concatenateAudioBuffers(audioBuffers);
  const duration = calculateDurationFromPCM(pcmBuffer.length);
  const wavBuffer = pcmToWav(pcmBuffer);

  yield* Effect.sync(() =>
    logger.info("PCM audio concatenated", {
      calculatedDurationMs: duration,
      calculatedDurationSec: (duration / 1000).toFixed(3),
      contentAudioId,
      pcmBufferLength: pcmBuffer.length,
    })
  );

  yield* verifyContentHash(store, {
    contentAudioId,
    errorMessage:
      "Content changed after speech generation, discarding to save costs",
    expectedHash: audio.contentHash,
    logMessage: "Content changed after speech generation",
  });

  const storageId = yield* Effect.tryPromise({
    try: () => providers.storeAudio({ wavBuffer }),
    catch: ioError,
  });

  yield* Effect.tryPromise({
    try: () =>
      store.saveAudio({
        contentAudioId,
        duration,
        size: wavBuffer.byteLength,
        storageId,
      }),
    catch: ioError,
  });

  yield* Effect.sync(() =>
    logger.info("Speech saved", {
      contentAudioId,
      durationMs: duration,
      durationSec: (duration / 1000).toFixed(3),
      size: wavBuffer.byteLength,
      storageId,
    })
  );

  return null;
});

/** Generates and stores speech audio for one claimed script row. */
export const generateAudioSpeech = Effect.fn(
  "audioStudies.generation.generateAudioSpeech"
)(function* (
  store: AudioGenerationStore,
  providers: AudioGenerationProviders,
  args: AudioGenerationArgs
) {
  yield* Effect.sync(() =>
    logger.info("Generating speech", { contentAudioId: args.contentAudioId })
  );

  const claimed = yield* Effect.tryPromise({
    try: () => store.claimSpeechGeneration(args.contentAudioId),
    catch: ioError,
  });

  if (!claimed) {
    yield* Effect.sync(() =>
      logger.info("Speech already claimed or generated", {
        contentAudioId: args.contentAudioId,
      })
    );
    return null;
  }

  yield* Effect.sync(() =>
    logger.info("Speech generation claimed", {
      contentAudioId: args.contentAudioId,
    })
  );

  return yield* runClaimedSpeechGeneration(
    store,
    providers,
    args.contentAudioId
  ).pipe(
    Effect.tapError((error) => markFailed(store, args.contentAudioId, error))
  );
});
