import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import { describedNonEmptyString } from "@repo/math/schema/shared";
import { Array as Arr, pipe, Schema, Struct } from "effect";

const SpecialistToolInputFields = {
  request: describedNonEmptyString(
    createPrompt({
      taskContext: `
        Task-relevant user request details only.

        Preserve user-provided:
        - names, dates, URLs, domains, versions, and source owners.
        - formulas, values, variables, matrices, and data.
        - language, level, context, and requested deliverables.

        Keep connective wording in the user's language after cleanup.
        Preserve technical names and terms exactly.
        Do not translate this field into English.
        Omit unrelated, repeated, emotional, or orchestration noise.
      `,
    })
  ),
  objective: describedNonEmptyString(
    createPrompt({
      taskContext: `
        Specialist job only.

        State what evidence, retrieval, or verification is needed.
        Do not include final-answer wording.
        Do not include instructions for weak, missing, or failed outcomes.
      `,
    })
  ),
  requirements: Schema.optionalKey(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable)
  ).annotate({
    description: createPrompt({
      taskContext: `
        Real constraints only.

        Include locale, current page, source ownership, recency, variables,
        assumptions, or requested evidence only when they matter.
        Do not include general answer-formatting, persona, or style rules.
        Do not include empty, fallback, or outcome-dependent instructions.
      `,
    }),
  }),
};
/**
 * Input schema for the Nakafa LearningCapability tool.
 */
export const NakafaToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  deliverables: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotate({
      description: createPrompt({
        taskContext: `
          Requested Nakafa deliverables only.

          Typical deliverable types:
          - lesson explanations.
          - summaries.
          - examples.
          - exercises or practice questions.
          - answers.
          - Quran references.
        `,
      }),
    }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: createPrompt({
      taskContext: `
        Nakafa content retrieval request.
      `,
    }),
  });
/**
 * Input schema for the deep research LearningCapability tool.
 */
const ResearchToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  sourceRequirements: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotate({
      description: createPrompt({
        taskContext: `
        Source requirements only.

        Include source ownership, recency, domain, URL, or credibility
        requirements. Do not include final-answer wording.
      `,
      }),
    }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: createPrompt({
      taskContext: `
        External research request.
      `,
    }),
  });
/**
 * Input schema for the deterministic math LearningCapability tool.
 */
const MathToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  given: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotate({
      description: createPrompt({
        taskContext: `
          Math givens only.

          Include expressions, equations, variables, assumptions, matrices,
          data, selected exercise content, or answer keys that must be checked.
          Do not add derived formulas or solution methods unless they come from
          the user or retrieved evidence being verified.
        `,
      }),
    }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: createPrompt({
      taskContext: `
        Deterministic math verification request.
      `,
    }),
  });
type NakafaToolInput = typeof NakafaToolInputSchema.Type;
type ResearchToolInput = typeof ResearchToolInputSchema.Type;
type MathToolInput = typeof MathToolInputSchema.Type;
type SpecialistToolInput = MathToolInput | NakafaToolInput | ResearchToolInput;
/**
 * Builds the internal Markdown task after the public tool input has separated
 * routing concerns from answer wording.
 */
export function formatSpecialistToolTask(input: SpecialistToolInput) {
  const sections = Arr.filter(
    [
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
    ],
    Boolean
  );
  return createPrompt({
    taskContext: Arr.join(sections, "\n\n"),
  });
}
/** Formats a single prose section for the internal specialist task. */
function formatTextSection(heading: string, text: string) {
  return createPrompt({
    taskContext: `
      # ${heading}

      ${text}
    `,
  });
}
/** Formats a list section, omitting it when no items are present. */
function formatListSection(heading: string, items: readonly string[]) {
  if (items.length === 0) {
    return "";
  }
  return createPrompt({
    taskContext: `
      # ${heading}

      ${pipe(
        items,
        Arr.map((item) => `- ${item}`),
        Arr.join("\n")
      )}
    `,
  });
}
export const nakafaToolInputSchema = createEffectSchema(NakafaToolInputSchema);
export const researchToolInputSchema = createEffectSchema(
  ResearchToolInputSchema
);
export const mathToolInputSchema = createEffectSchema(MathToolInputSchema);
export const textOutputSchema = createEffectSchema(Schema.String);
