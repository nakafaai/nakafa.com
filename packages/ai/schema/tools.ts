import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { type InferUITools, tool } from "ai";
import { Schema } from "effect";

export const ToolNameSchema = Schema.Literal("nakafa", "deepResearch", "math");
export type ToolName = Schema.Schema.Type<typeof ToolNameSchema>;

/**
 * Input schema for the Nakafa orchestrator tool.
 */
export const NakafaToolInputSchema = Schema.Struct({
  task: Schema.NonEmptyString.annotations({
    description:
      "A concise Markdown brief for Nakafa educational evidence. Include '# User Request' with the exact user wording, '# Task' with what Nakafa must retrieve or read, and relevant context or constraints. Preserve every requested deliverable, including lesson explanations, summaries, examples, exercises, practice questions, answers, or Quran references.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa content retrieval request." });

/**
 * Input schema for the deep research orchestrator tool.
 */
export const ResearchToolInputSchema = Schema.Struct({
  task: Schema.NonEmptyString.annotations({
    description:
      "A concise Markdown brief for external or current-information research. Include '# User Request' with the exact user wording, '# Task' with the research objective, and relevant context or constraints. Preserve exact user wording for named products, APIs, libraries, features, versions, domains, URLs, source constraints, source-ownership constraints, and document titles. Do not summarize away the user's requested evidence source.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "External research request." });

/**
 * Input schema for the deterministic math orchestrator tool.
 */
export const MathToolInputSchema = Schema.Struct({
  task: Schema.NonEmptyString.annotations({
    description:
      "A concise Markdown brief for deterministic math verification. Include '# User Request' with the exact user wording, '# Task' with the math objective, and the expressions, data, variables, assumptions, and requested verification. Use this even for natural student wording like checking whether work is valid, correct, equivalent, or proven.",
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
