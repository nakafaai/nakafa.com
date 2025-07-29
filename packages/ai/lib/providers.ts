import { gateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";

const languageModels = {
  google: gateway("google/gemini-2.5-flash"),
};

export const model = customProvider({
  languageModels,
});

export type modelID = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels);

export const defaultModel: modelID = "google";
