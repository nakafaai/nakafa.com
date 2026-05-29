import { createGatewayLanguageModel } from "@repo/ai/config/gateway-core";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  getModelGatewayId,
  getModelProviderOptions,
} from "@repo/ai/config/models";
import { podcastScriptPrompt } from "@repo/ai/prompt/audio-studies/v3";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  AudioGenerationActionError,
  failContentChanged,
  getErrorMessage,
} from "@repo/backend/confect/modules/content/audioGeneration.errors";
import { generateText } from "ai";
import { Effect } from "effect";

/** Generates and stores a podcast script for one content audio row. */
export const generateScript = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
}) {
  const mutations = yield* MutationRunner;
  const queries = yield* QueryRunner;
  yield* Effect.logInfo("Generating audio script.", args);

  const claimed = yield* mutations(
    refs.internal.audioStudies.mutations.contentAudios.claimScriptGeneration,
    args
  );

  if (!claimed) {
    yield* Effect.logInfo("Audio script generation was already claimed.", args);
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
      refs.internal.audioStudies.queries.internalFunctions.verifyContentHash,
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
        model: createGatewayLanguageModel(getModelGatewayId("nakafa-pro")),
        prompt,
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getModelProviderOptions("nakafa-pro"),
        },
      })
    );
    const hashValidAfter = yield* queries(
      refs.internal.audioStudies.queries.internalFunctions.verifyContentHash,
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
});
