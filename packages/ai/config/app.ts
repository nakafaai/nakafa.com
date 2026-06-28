import { createAppLanguageModel } from "@repo/ai/config/devtools";
import { ModelKeySchema, modelRegistry } from "@repo/ai/config/model";
import { NoSuchModelError } from "ai";
import { Option, Schema } from "effect";

/**
 * App-facing AI SDK provider.
 *
 * This provider may use AI SDK DevTools in development, so Convex code should
 * import the plain Gateway provider from `provider.ts` instead.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/custom-provider
 */
export const provider = {
  /**
   * Resolves public Nakafa model IDs lazily so importing app config during
   * Next.js builds does not validate AI Gateway secrets before a model is used.
   */
  languageModel(modelId: string) {
    const modelKey = Schema.decodeUnknownOption(ModelKeySchema)(modelId);

    if (Option.isNone(modelKey)) {
      return unsupportedModel(modelId, "languageModel");
    }

    return createAppLanguageModel(modelRegistry[modelKey.value].gatewayId);
  },
  embeddingModel(modelId: string) {
    return unsupportedModel(modelId, "embeddingModel");
  },
  imageModel(modelId: string) {
    return unsupportedModel(modelId, "imageModel");
  },
  rerankingModel(modelId: string) {
    return unsupportedModel(modelId, "rerankingModel");
  },
};

/** Reports unsupported model families through the AI SDK provider contract. */
function unsupportedModel(
  modelId: string,
  modelType: ConstructorParameters<typeof NoSuchModelError>[0]["modelType"]
): never {
  throw new NoSuchModelError({ modelId, modelType });
}
