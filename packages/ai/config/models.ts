import type { GatewayModelId } from "@ai-sdk/gateway";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";

/**
 * User-facing Nakafa chat models.
 */
export const MODEL_IDS = ["nakafa-lite", "nakafa-pro"] as const;

export type ModelId = (typeof MODEL_IDS)[number];

const interactiveProviderOptions = {
  thinkingConfig: {
    includeThoughts: true,
    thinkingLevel: "high",
  },
} satisfies GoogleLanguageModelOptions;

const fastProviderOptions = {
  thinkingConfig: {
    thinkingLevel: "low",
  },
} satisfies GoogleLanguageModelOptions;

export const modelRegistry = {
  "nakafa-lite": {
    credits: 2,
    gatewayId: "google/gemini-3.1-flash-lite",
    providerOptions: {
      fast: fastProviderOptions,
      interactive: interactiveProviderOptions,
    },
  },
  "nakafa-pro": {
    credits: 5,
    gatewayId: "google/gemini-3-pro-preview",
    providerOptions: {
      fast: fastProviderOptions,
      interactive: interactiveProviderOptions,
    },
  },
} satisfies Record<
  ModelId,
  {
    credits: number;
    gatewayId: GatewayModelId;
    providerOptions: {
      fast: GoogleLanguageModelOptions;
      interactive: GoogleLanguageModelOptions;
    };
  }
>;

export const defaultModel = "nakafa-lite" satisfies ModelId;

/** Checks whether an untrusted string is one of the public Nakafa model IDs. */
export function isModelId(value: string): value is ModelId {
  return MODEL_IDS.some((modelId) => modelId === value);
}

/** Returns the credit cost for one Nakafa model response. */
export function getModelCreditCost(modelId: ModelId) {
  return modelRegistry[modelId].credits;
}

/** Returns whether the current balance can pay for one Nakafa model response. */
export function hasEnoughCredits(currentCredits: number, modelId: ModelId) {
  return currentCredits >= getModelCreditCost(modelId);
}

/** Returns the Vercel AI Gateway model behind a Nakafa model. */
export function getModelGatewayId(modelId: ModelId) {
  return modelRegistry[modelId].gatewayId;
}

/** Returns Gemini provider options for one Nakafa model. */
export function getModelProviderOptions(modelId: ModelId) {
  return modelRegistry[modelId].providerOptions.interactive;
}

/** Returns Gemini provider options for background and tool-routing calls. */
export function getFastModelProviderOptions(modelId: ModelId) {
  return modelRegistry[modelId].providerOptions.fast;
}
