import { createWrappedLanguageModel } from "@repo/ai/config/devtools";
import {
  LanguageModelProvider,
  LanguageModelProviderError,
} from "@repo/ai/config/language/service";
import { getModelGatewayId, type ModelId } from "@repo/ai/config/model";
import { messageFromUnknown } from "@repo/utilities/error/message";
import { Effect, Layer } from "effect";

/** Resolves one schema-decoded Nakafa model ID through the Gateway-backed app model Adapter. */
const resolveLanguageModel = Effect.fn("ai.languageModel.resolve")(function* (
  modelId: ModelId
) {
  return yield* Effect.try({
    try: () => createWrappedLanguageModel(getModelGatewayId(modelId)),
    catch: (error) =>
      new LanguageModelProviderError({
        message: messageFromUnknown(error, "Unable to resolve language model."),
        source: "languageModelProvider.resolve",
      }),
  });
});

/** Live AI Gateway Adapter for the LanguageModelProvider seam. */
export const LiveLanguageModelProvider = Layer.succeed(LanguageModelProvider, {
  resolve: resolveLanguageModel,
});
