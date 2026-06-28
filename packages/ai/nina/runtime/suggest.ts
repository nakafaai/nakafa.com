import { provider } from "@repo/ai/config/app";
import {
  defaultModel,
  getFastModelProviderOptions,
} from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { suggestionGenerationTimeout } from "@repo/ai/config/timeouts";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import {
  type ModelMessage,
  Output,
  pruneMessages,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import { Effect, Schema, Stream } from "effect";

const SuggestionsOutputSchema = createEffectSchema(
  Schema.Struct({
    suggestions: Schema.Array(Schema.String).annotations({
      description:
        "Exactly 5 natural follow-up questions or requests from the student's perspective.",
    }),
  })
);

/** Raised when Nina cannot stream follow-up suggestions after an answer. */
export class NinaSuggestionError extends Schema.TaggedError<NinaSuggestionError>()(
  "NinaSuggestionError",
  {
    message: Schema.String,
  }
) {}

/**
 * Streams follow-up suggestions after the assistant response is complete.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/output#output-object
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const writeNinaSuggestions = Effect.fn("nina.suggest.write")(function* ({
  locale,
  messages,
  writer,
}: {
  readonly locale: Locale;
  readonly messages: ModelMessage[];
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const promptMessages = pruneMessages({
    messages,
    reasoning: "all",
    toolCalls: "all",
  });

  const suggestionsStream = streamText({
    model: provider.languageModel(defaultModel),
    instructions: nakafaSuggestions({ locale }),
    messages: promptMessages,
    output: Output.object({
      schema: SuggestionsOutputSchema,
    }),
    providerOptions: {
      gateway: gatewayProviderOptions,
      google: getFastModelProviderOptions(defaultModel),
    },
    timeout: suggestionGenerationTimeout,
  });

  const dataPartId = crypto.randomUUID();

  yield* Stream.fromAsyncIterable(
    suggestionsStream.partialOutputStream,
    () =>
      new NinaSuggestionError({
        message: "Failed to stream Nina suggestions.",
      })
  ).pipe(
    Stream.runForEach((chunk) =>
      Effect.sync(() => {
        const suggestions =
          chunk.suggestions?.filter((suggestion) => suggestion !== undefined) ??
          [];

        if (suggestions.length === 0) {
          return;
        }

        writer.write({
          id: dataPartId,
          type: "data-suggestions",
          data: {
            data: suggestions,
          },
        });
      })
    )
  );

  const output = yield* Effect.tryPromise({
    try: () => suggestionsStream.output,
    catch: () =>
      new NinaSuggestionError({
        message: "Failed to complete Nina suggestions.",
      }),
  });

  if (output.suggestions.length === 0) {
    return;
  }

  yield* Effect.sync(() =>
    writer.write({
      id: dataPartId,
      type: "data-suggestions",
      data: {
        data: [...output.suggestions],
      },
    })
  );
});
