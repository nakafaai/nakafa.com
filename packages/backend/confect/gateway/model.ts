import type { GatewayModelId } from "@ai-sdk/gateway";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { Schema } from "effect";

/** The language models a learner chooses between in Nakafa. */
export const ModelKey = Schema.Literals(["nakafa-lite", "nakafa-pro"]);
export type ModelKey = typeof ModelKey.Type;

/**
 * A model key accepted from clients and stored with each Nina turn.
 *
 * @see https://effect.website/docs/code-style/branded-types/
 */
export const ModelId = ModelKey.pipe(Schema.brand("@Nakafa/ModelId"));
export type ModelId = typeof ModelId.Type;

export const defaultModel = ModelId.make("nakafa-lite");

/** The gateway model behind each key. */
export const models = {
  "nakafa-lite": "google/gemini-3.5-flash-lite",
  "nakafa-pro": "google/gemini-3.7-flash",
} satisfies Record<ModelKey, GatewayModelId>;

/** How much a model reasons: deeply for answers, briefly for supporting work. */
export const Effort = Schema.Literals(["fast", "interactive"]);
export type Effort = typeof Effort.Type;

/** Gemini's thinking options for each effort; every key runs a Gemini model. */
export const thinking = {
  fast: { thinkingConfig: { thinkingLevel: "low" } },
  interactive: {
    thinkingConfig: { includeThoughts: true, thinkingLevel: "high" },
  },
} satisfies Record<Effort, GoogleLanguageModelOptions>;
