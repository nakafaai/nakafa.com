import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { type InferUITools, tool } from "ai";
import { Schema } from "effect";

export const ToolNameSchema = Schema.Literal("nakafa", "deepResearch", "math");
export type ToolName = Schema.Schema.Type<typeof ToolNameSchema>;

/**
 * Input schema for the Nakafa orchestrator tool.
 */
export const NakafaToolInputSchema = Schema.Struct({
  query: Schema.NonEmptyString.annotations({
    description:
      "The specific request about Nakafa-owned content. Include the current URL, verified status, user goal, and enough subject, article, exercise, Quran, or current-page context to search or read the right Nakafa source.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa content retrieval request." });

/**
 * Input schema for the deep research orchestrator tool.
 */
export const ResearchToolInputSchema = Schema.Struct({
  query: Schema.NonEmptyString.annotations({
    description:
      "The external or current-information research task. Include what the user is asking, why they need it, current page context, recency needs, and any background that helps focus source selection.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "External research request." });

/**
 * Input schema for the deterministic math orchestrator tool.
 */
export const MathToolInputSchema = Schema.Struct({
  query: Schema.NonEmptyString.annotations({
    description:
      "The math request to verify through deterministic math evidence. Use this even for natural student wording like checking whether work is valid, correct, equivalent, or proven. Include expressions or data, target operation, variables, assumptions, and whether the user needs arithmetic, algebra, equations, calculus, series, matrices, statistics, probability, geometry, or discrete math.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Deterministic math verification request." });

export const nakafaToolInputSchema = createEffectSchema(NakafaToolInputSchema);
export const researchToolInputSchema = createEffectSchema(
  ResearchToolInputSchema
);
export const mathToolInputSchema = createEffectSchema(MathToolInputSchema);
export const textOutputSchema = createEffectSchema(Schema.String);

const uiTools = {
  nakafa: tool({
    inputSchema: nakafaToolInputSchema,
    outputSchema: textOutputSchema,
  }),
  deepResearch: tool({
    inputSchema: researchToolInputSchema,
    outputSchema: textOutputSchema,
  }),
  math: tool({
    inputSchema: mathToolInputSchema,
    outputSchema: textOutputSchema,
  }),
};

export type MyUITools = InferUITools<typeof uiTools>;
