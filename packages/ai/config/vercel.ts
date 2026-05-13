import { createWrappedLanguageModel } from "@repo/ai/config/gateway";
import { MODEL_IDS, modelRegistry } from "@repo/ai/config/models";
import { customProvider } from "ai";

type WrappedModel = ReturnType<typeof createWrappedLanguageModel>;
type LanguageModelMap = { [K in keyof typeof modelRegistry]: WrappedModel };

const languageModels: LanguageModelMap = Object.assign(
  {},
  ...MODEL_IDS.map((id) => ({
    [id]: createWrappedLanguageModel(modelRegistry[id].gatewayId),
  }))
);

export const model = customProvider({
  languageModels,
});
