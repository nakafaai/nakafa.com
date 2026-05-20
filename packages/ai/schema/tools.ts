import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { createPrompt } from "@repo/ai/prompt/utils";
import { type InferUITools, tool } from "ai";
import dedent from "dedent";
import { Schema } from "effect";

export const ToolNameSchema = Schema.Literal("nakafa", "deepResearch", "math");
export type ToolName = Schema.Schema.Type<typeof ToolNameSchema>;

const SpecialistToolInputFields = {
  request: Schema.NonEmptyString.annotations({
    description: dedent(`
      Task-relevant user request details only.

      Preserve user-provided:
      - names, dates, URLs, domains, versions, and source owners.
      - formulas, values, variables, matrices, and data.
      - language, level, context, and requested deliverables.

      Keep connective wording in the user's language after cleanup.
      Preserve technical names and terms exactly.
      Do not translate this field into English.
      Omit unrelated, repeated, emotional, or orchestration noise.
    `),
  }),
  objective: Schema.NonEmptyString.annotations({
    description: dedent(`
      Specialist job only.

      State what evidence, retrieval, or verification is needed.
      Do not include final-answer wording.
      Do not include instructions for weak, missing, or failed outcomes.
    `),
  }),
  requirements: Schema.optional(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable)
  ).annotations({
    description: dedent(`
        Real constraints only.

        Include locale, current page, source ownership, recency, variables,
        assumptions, or requested evidence only when they matter.
        Do not include general answer-formatting, persona, or style rules.
        Do not include empty, fallback, or outcome-dependent instructions.
      `),
  }),
};

/**
 * Input schema for the Nakafa orchestrator tool.
 */
export const NakafaToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  deliverables: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description: dedent(`
      Requested Nakafa deliverables only.

      Examples:
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
  ...SpecialistToolInputFields,
  sourceRequirements: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description: dedent(`
        Source requirements only.

        Include source ownership, recency, domain, URL, or credibility
        requirements. Do not include final-answer wording.
      `),
    }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "External research request." });

/**
 * Input schema for the deterministic math orchestrator tool.
 */
export const MathToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  given: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description: dedent(`
      Math givens only.

      Include expressions, equations, variables, assumptions, matrices,
      data, selected exercise content, or answer keys that must be checked.
      Do not add derived formulas or solution methods unless they come from
      the user or retrieved evidence being verified.
      `),
    }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Deterministic math verification request." });

export type NakafaToolInput = Schema.Schema.Type<typeof NakafaToolInputSchema>;
export type ResearchToolInput = Schema.Schema.Type<
  typeof ResearchToolInputSchema
>;
export type MathToolInput = Schema.Schema.Type<typeof MathToolInputSchema>;

type SpecialistToolInput = MathToolInput | NakafaToolInput | ResearchToolInput;

/**
 * Builds the internal Markdown task after the public tool input has separated
 * routing concerns from answer wording.
 */
export function formatSpecialistToolTask(input: SpecialistToolInput) {
  const sections = [
    formatTextSection("Request", input.request),
    formatTextSection("Objective", input.objective),
    formatListSection("Requirements", input.requirements ?? []),
    formatListSection(
      "Source Requirements",
      "sourceRequirements" in input ? input.sourceRequirements : []
    ),
    formatListSection(
      "Deliverables",
      "deliverables" in input ? input.deliverables : []
    ),
    formatListSection("Given", "given" in input ? input.given : []),
  ].filter(Boolean);

  return createPrompt({
    taskContext: sections.join("\n\n"),
  });
}

/** Formats a single prose section for the internal specialist task. */
function formatTextSection(heading: string, text: string) {
  return dedent(`
    # ${heading}

    ${text}
  `);
}

/** Formats a list section, omitting it when no items are present. */
function formatListSection(heading: string, items: readonly string[]) {
  if (items.length === 0) {
    return "";
  }

  return dedent(`
    # ${heading}

    ${items.map((item) => `- ${item}`).join("\n")}
  `);
}

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
