import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { type InferUITools, tool } from "ai";
import dedent from "dedent";
import { Schema } from "effect";

export const ToolNameSchema = Schema.Literal("nakafa", "deepResearch", "math");
export type ToolName = Schema.Schema.Type<typeof ToolNameSchema>;

/**
 * Input schema for the Nakafa orchestrator tool.
 */
export const NakafaToolInputSchema = Schema.Struct({
  task: Schema.NonEmptyString.annotations({
    description: dedent(`
      A concise Markdown brief for Nakafa educational evidence.

      Include:
      - # User Request with the exact user wording.
      - # Task with what Nakafa must retrieve or read.
      - Relevant context or constraints.

      Preserve every requested deliverable:
      - lesson explanations.
      - summaries.
      - examples.
      - exercises or practice questions.
      - answers.
      - Quran references.
    `),
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa content retrieval request." });

/**
 * Input schema for the deep research orchestrator tool.
 */
export const ResearchToolInputSchema = Schema.Struct({
  task: Schema.NonEmptyString.annotations({
    description: dedent(`
      A concise Markdown brief for external or current-information research.

      Include:
      - # User Request with the exact user wording.
      - # Task with the research objective.
      - Relevant context or constraints.

      Preserve exact user wording for:
      - named products, APIs, libraries, and features.
      - versions, domains, and URLs.
      - source constraints and source-ownership constraints.
      - document titles.

      Do not summarize away the user's requested evidence source.
    `),
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "External research request." });

/**
 * Input schema for the deterministic math orchestrator tool.
 */
export const MathToolInputSchema = Schema.Struct({
  task: Schema.NonEmptyString.annotations({
    description: dedent(`
      A concise Markdown brief for deterministic math verification.

      Include:
      - # User Request with the exact user wording.
      - # Task with the math objective.
      - Expressions, data, variables, assumptions, and requested verification.

      Use this for user-provided or retrieved math, including natural student wording like:
      - valid.
      - correct.
      - equivalent.
      - proven.

      Do not use this as the first or only source for:
      - educational practice sets.
      - warmups, quizzes, or tryout preparation.
      - examples, hints, or review tasks.

      Use Nakafa first for content selection.
    `),
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
