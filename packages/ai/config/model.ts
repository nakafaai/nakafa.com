import type { GatewayModelId } from "@ai-sdk/gateway";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { Brand, Schema } from "effect";

/**
 * User-facing Nakafa chat models.
 */
export const MODEL_IDS = ["nakafa-lite", "nakafa-pro"] as const;

/**
 * Runtime schema for public Nakafa model IDs accepted by clients and Convex.
 *
 * @see https://effect.website/docs/code-style/branded-types/
 */
export const ModelKeySchema = Schema.Literal(...MODEL_IDS);
export const ModelIdSchema = ModelKeySchema.pipe(
  Schema.brand("@Nakafa/ModelId")
);

export type ModelKey = Schema.Schema.Type<typeof ModelKeySchema>;
export type ModelId = Schema.Schema.Type<typeof ModelIdSchema>;

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

export const ModelInfoSchema = Schema.Struct({
  credits: Schema.Number.pipe(Schema.int(), Schema.positive()),
  gatewayId: Schema.Literal("google/gemini-3-flash", "google/gemini-3.5-flash"),
}).annotations({
  description: "Public Nakafa model metadata used for billing and routing.",
});

export type ModelInfo = Schema.Schema.Type<typeof ModelInfoSchema>;

export const modelRegistry = {
  "nakafa-lite": {
    credits: 2,
    gatewayId: "google/gemini-3-flash",
    providerOptions: {
      fast: fastProviderOptions,
      interactive: interactiveProviderOptions,
    },
  },
  "nakafa-pro": {
    credits: 5,
    gatewayId: "google/gemini-3.5-flash",
    providerOptions: {
      fast: fastProviderOptions,
      interactive: interactiveProviderOptions,
    },
  },
} satisfies Record<
  ModelKey,
  ModelInfo & {
    gatewayId: GatewayModelId;
    providerOptions: {
      fast: GoogleLanguageModelOptions;
      interactive: GoogleLanguageModelOptions;
    };
  }
>;

export const defaultModel = ModelIdSchema.make("nakafa-lite");

/** Checks whether an untrusted string is one of the public Nakafa model IDs. */
export function isModelId(value: string): value is ModelId {
  return Schema.is(ModelIdSchema)(value);
}

/** Returns the credit cost for one Nakafa model response. */
export function getModelCreditCost(modelId: ModelId) {
  return modelRegistry[Brand.unbranded(modelId)].credits;
}

/** Returns whether the current balance can pay for one Nakafa model response. */
export function hasEnoughCredits(currentCredits: number, modelId: ModelId) {
  return currentCredits >= getModelCreditCost(modelId);
}

/** Returns the Vercel AI Gateway model behind a Nakafa model. */
export function getModelGatewayId(modelId: ModelId) {
  return modelRegistry[Brand.unbranded(modelId)].gatewayId;
}

/** Returns Gemini provider options for one Nakafa model. */
export function getModelProviderOptions(modelId: ModelId) {
  return modelRegistry[Brand.unbranded(modelId)].providerOptions.interactive;
}

/** Returns Gemini provider options for background and tool-routing calls. */
export function getFastModelProviderOptions(modelId: ModelId) {
  return modelRegistry[Brand.unbranded(modelId)].providerOptions.fast;
}
