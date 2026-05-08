import { defaultModel } from "@repo/ai/config/models";
import {
  type GatewayProvider,
  type GoogleProvider,
  model,
  order,
} from "@repo/ai/config/vercel";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  type ModelMessage,
  Output,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import { Effect } from "effect";
import * as z from "zod";

interface Params {
  messages: ModelMessage[];
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Streams follow-up suggestions after the assistant response is complete.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/output#output-object
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const writeSuggestions = Effect.fn("chat.writeSuggestions")(function* ({
  messages,
  writer,
}: Params) {
  const suggestionsStream = streamText({
    model: model.languageModel(defaultModel),
    system: nakafaSuggestions(),
    messages,
    output: Output.object({
      schema: z.object({
        suggestions: z
          .array(z.string())
          .describe(
            "An array of suggested questions or statements that a user would want to ask or tell next"
          ),
      }),
    }),
    providerOptions: {
      gateway: { order } satisfies GatewayProvider,
      google: {
        thinkingConfig: {
          thinkingBudget: 0,
          includeThoughts: false,
        },
      } satisfies GoogleProvider,
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
