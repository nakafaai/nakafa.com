import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  defaultModel,
  getFastModelProviderOptions,
} from "@repo/ai/config/models";
import { backgroundGenerationTimeout } from "@repo/ai/config/timeouts";
import { model } from "@repo/ai/config/vercel";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  type ModelMessage,
  Output,
  pruneMessages,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import { Effect, Schema, Stream } from "effect";

interface Params {
  locale: Locale;
  messages: ModelMessage[];
  writer: UIMessageStreamWriter<MyUIMessage>;
}

const SuggestionsOutputSchema = createEffectSchema(
  Schema.Struct({
    suggestions: Schema.Array(Schema.String).annotations({
      description:
        "Exactly 5 natural follow-up questions or requests from the student's perspective.",
    }),
  })
);

/**
 * Streams follow-up suggestions after the assistant response is complete.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/output#output-object
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const writeSuggestions = Effect.fn("chat.writeSuggestions")(function* ({
  locale,
  messages,
  writer,
}: Params) {
  // Suggestions only need the visible conversation and final answer shape.
  // Keep reasoning stored/rendered elsewhere, but remove it from this secondary
  // model call so follow-up generation does not spend tokens on internal traces.
  // https://ai-sdk.dev/docs/reference/ai-sdk-ui/prune-messages
  const promptMessages = pruneMessages({
    messages,
    reasoning: "all",
    toolCalls: "all",
  });

  const suggestionsStream = streamText({
    model: model.languageModel(defaultModel),
    system: nakafaSuggestions({ locale }),
    messages: promptMessages,
    output: Output.object({
      schema: SuggestionsOutputSchema,
    }),
    providerOptions: {
      gateway: gatewayProviderOptions,
      google: getFastModelProviderOptions(defaultModel),
    },
    timeout: backgroundGenerationTimeout,
  });

  const dataPartId = crypto.randomUUID();

  yield* Stream.fromAsyncIterable(
    suggestionsStream.partialOutputStream,
    (cause) => new Error("Failed to stream chat suggestions.", { cause })
  ).pipe(
    Stream.runForEach((chunk) =>
      Effect.sync(() => {
        writer.write({
          id: dataPartId,
          type: "data-suggestions",
          data: {
            data:
              chunk.suggestions?.filter(
                (suggestion) => suggestion !== undefined
              ) ?? [],
          },
        });
      })
    )
  );
});
