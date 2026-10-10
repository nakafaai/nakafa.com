import { Schema } from "effect";

/** The language model behind every Nakafa call, as the Convex AI gateway names it. */
export const languageModelId = "google/gemini-3.8-flash";

/** How much a model reasons: deeply for answers, briefly for supporting work. */
export const Effort = Schema.Literals(["fast", "interactive"]);
export type Effort = typeof Effort.Type;

/** How much the model reasons for each effort. */
export const reasoning = {
  fast: "low",
  interactive: "high",
} satisfies Record<Effort, "low" | "high">;
