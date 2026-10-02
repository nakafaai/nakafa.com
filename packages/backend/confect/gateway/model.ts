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

/** How much a model reasons: deeply for answers, briefly for supporting work. */
export type Effort = "fast" | "interactive";

const efforts = {
  fast: { thinkingConfig: { thinkingLevel: "low" } },
  interactive: {
    thinkingConfig: { includeThoughts: true, thinkingLevel: "high" },
  },
} satisfies Record<Effort, GoogleLanguageModelOptions>;

/** The gateway model behind each key and its Gemini options for each effort. */
export const models = {
  "nakafa-lite": { gateway: "google/gemini-3.5-flash-lite", options: efforts },
  "nakafa-pro": { gateway: "google/gemini-3.7-flash", options: efforts },
} satisfies Record<
  ModelKey,
  {
    gateway: GatewayModelId;
    options: Record<Effort, GoogleLanguageModelOptions>;
  }
>;
