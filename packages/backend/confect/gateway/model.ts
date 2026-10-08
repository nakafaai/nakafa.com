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

/** The Convex AI gateway model behind each key, as `provider/model`. */
export const models = {
  "nakafa-lite": "google/gemini-3.5-flash-lite",
  "nakafa-pro": "google/gemini-3.7-flash",
} satisfies Record<ModelKey, string>;

/** How much a model reasons: deeply for answers, briefly for supporting work. */
export const Effort = Schema.Literals(["fast", "interactive"]);
export type Effort = typeof Effort.Type;

/** How much the model reasons for each effort. */
export const reasoning = {
  fast: "low",
  interactive: "high",
} satisfies Record<Effort, "low" | "high">;
