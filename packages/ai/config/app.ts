import { createWrappedLanguageModel } from "@repo/ai/config/devtools";
import { type ModelKey, modelRegistry } from "@repo/ai/config/model";
import { customProvider } from "ai";

const languageModels = {
  "nakafa-lite": createWrappedLanguageModel(
    modelRegistry["nakafa-lite"].gatewayId
  ),
  "nakafa-pro": createWrappedLanguageModel(
    modelRegistry["nakafa-pro"].gatewayId
  ),
} satisfies Record<ModelKey, ReturnType<typeof createWrappedLanguageModel>>;

/**
 * App-facing AI SDK provider.
 *
 * This provider may use AI SDK DevTools in development, so Convex code should
 * import the plain Gateway provider from `provider.ts` instead.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/custom-provider
 */
export const provider = customProvider({
  languageModels,
});
