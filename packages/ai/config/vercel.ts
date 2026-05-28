import { createWrappedLanguageModel } from "@repo/ai/config/gateway";
import { type ModelId, modelRegistry } from "@repo/ai/config/models";

/** Lazily creates the AI Gateway model selected by one public Nakafa model id. */
function languageModel(modelId: ModelId) {
  return createWrappedLanguageModel(modelRegistry[modelId].gatewayId);
}

/** Public model provider used by AI generation code. */
export const model = { languageModel };
