import type { GatewayModelId } from "@ai-sdk/gateway";
import { Function as EffectFunction, Schema } from "effect";
/**
 * User-facing Nakafa chat models.
 */
export const MODEL_IDS = ["nakafa-lite", "nakafa-pro"] as const;
/**
 * Runtime schema for public Nakafa model IDs accepted by clients and Convex.
 *
 * @see https://effect.website/docs/code-style/branded-types/
 */
export const ModelKeySchema = Schema.Literals(MODEL_IDS);
export const ModelIdSchema = ModelKeySchema.pipe(
  Schema.brand("@Nakafa/ModelId")
);
export type ModelKey = Schema.Schema.Type<typeof ModelKeySchema>;
export type ModelId = Schema.Schema.Type<typeof ModelIdSchema>;
const ModelReasoningSchema = Schema.Struct({
  background: Schema.Literal("low"),
  interactive: Schema.Literal("high"),
});
export const ModelInfoSchema = Schema.Struct({
  credits: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  gatewayId: Schema.Literals(["openai/gpt-5-mini", "openai/gpt-5.4-mini"]),
  reasoning: ModelReasoningSchema,
}).annotate({
  description: "Public Nakafa model metadata used for billing and routing.",
});
export type ModelInfo = Schema.Schema.Type<typeof ModelInfoSchema>;
export const modelRegistry = {
  "nakafa-lite": {
    credits: 2,
    gatewayId: "openai/gpt-5-mini",
    reasoning: {
      background: "low",
      interactive: "high",
    },
  },
  "nakafa-pro": {
    credits: 5,
    gatewayId: "openai/gpt-5.4-mini",
    reasoning: {
      background: "low",
      interactive: "high",
    },
  },
} satisfies Record<ModelKey, ModelInfo & { gatewayId: GatewayModelId }>;
export const defaultModel = ModelIdSchema.make("nakafa-lite");
/** Checks whether an untrusted string is one of the public Nakafa model IDs. */
export function isModelId(value: string): value is ModelId {
  return Schema.is(ModelIdSchema)(value);
}
/** Returns the credit cost for one Nakafa model response. */
export function getModelCreditCost(modelId: ModelId) {
  return modelRegistry[EffectFunction.cast<ModelId, ModelKey>(modelId)].credits;
}
/** Returns whether the current balance can pay for one Nakafa model response. */
export function hasEnoughCredits(currentCredits: number, modelId: ModelId) {
  return currentCredits >= getModelCreditCost(modelId);
}
/** Returns the Vercel AI Gateway model behind a Nakafa model. */
export function getModelGatewayId(modelId: ModelId) {
  return modelRegistry[EffectFunction.cast<ModelId, ModelKey>(modelId)]
    .gatewayId;
}
/** Returns provider-neutral reasoning for an interactive Nakafa response. */
export function getInteractiveModelReasoning(modelId: ModelId) {
  return modelRegistry[EffectFunction.cast<ModelId, ModelKey>(modelId)]
    .reasoning.interactive;
}
/** Returns provider-neutral reasoning for background and tool-routing calls. */
export function getBackgroundModelReasoning(modelId: ModelId) {
  return modelRegistry[EffectFunction.cast<ModelId, ModelKey>(modelId)]
    .reasoning.background;
}
