import { defaultModel } from "@repo/ai/config/models";
import { type GatewayProvider, model, order } from "@repo/ai/config/vercel";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  type ModelMessage,
  Output,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import { Effect, Schema } from "effect";

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
  const suggestionsStream = streamText({
    model: model.languageModel(defaultModel),
    system: nakafaSuggestions({ locale }),
    messages,
    output: Output.object({
      schema: SuggestionsOutputSchema,
    }),
    providerOptions: {
      gateway: { order } satisfies GatewayProvider,
    },
  });

  const dataPartId = crypto.randomUUID();

  yield* Effect.tryPromise(async () => {
    for await (const chunk of suggestionsStream.partialOutputStream) {
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
    }
  });
});
