import { Schema } from "effect";

/** The language model behind every Nakafa call, as the Convex AI gateway names it. */
export const languageModelId = "google/gemini-3.8-flash";

/**
 * The decision model behind every judgment of a learner's words, as the Convex
 * AI gateway names it: Jev from TypeSafe, which answers typed questions about a
 * text with a probability instead of writing text.
 */
export const decisionModelId = "typesafe/jev-1.13";

/** How much a model reasons: deeply for answers, briefly for supporting work. */
export const Effort = Schema.Literals(["fast", "interactive"]);
export type Effort = typeof Effort.Type;

/** How much the model reasons for each effort. */
export const reasoning = {
  fast: "low",
  interactive: "high",
} satisfies Record<Effort, "low" | "high">;
