import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import { describedNonEmptyString } from "@repo/math/schema/shared";
import { Array as Arr, pipe, Record as Rec, Schema, Struct } from "effect";

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
/** Every field that any specialist tool takes. A call holds only its own tool's. */
type SpecialistToolFields = Partial<
  MathToolInput & NakafaToolInput & ResearchToolInput
>;
/**
 * The heading of each section of a specialist task. The order of the keys is
 * the order of the sections, in the task and in its words alike, and the
 * compiler asks for a heading when a tool gains a field.
 */
const SECTION_HEADINGS = {
  request: "Request",
  objective: "Objective",
  requirements: "Requirements",
  sourceRequirements: "Source Requirements",
  deliverables: "Deliverables",
  given: "Given",
} satisfies Record<keyof SpecialistToolFields, string>;
/**
 * Reads the sections that one tool call holds, in the order of the task: the
 * heading of each with its text or its list of items. A field that the tool
 * does not take, or that the call left out, has no section.
 */
function readSections(input: SpecialistToolInput) {
  const fields: SpecialistToolFields = input;
  return Arr.flatMap(Rec.toEntries(SECTION_HEADINGS), ([field, heading]) => {
    const value = fields[field];
    return value === undefined ? [] : [{ heading, value }];
  });
}
/**
 * Builds the internal Markdown task after the public tool input has separated
 * routing concerns from answer wording.
 */
export function formatSpecialistToolTask(input: SpecialistToolInput) {
  const sections = Arr.filter(
    Arr.map(readSections(input), ({ heading, value }) =>
      Arr.isArray(value)
        ? formatListSection(heading, value)
        : formatTextSection(heading, value)
    ),
    Boolean
  );
  return createPrompt({
    taskContext: Arr.join(sections, "\n\n"),
  });
}
/**
 * Gives the words of a tool call, for the code that looks for them in a page:
 * the text of the same fields as the task, in the same order, one item per
 * line and with no heading. A heading belongs to the task, not to the tool
 * call, and no line is left out for how it starts.
 */
export function getSpecialistToolWords(input: SpecialistToolInput) {
  return pipe(
    readSections(input),
    Arr.flatMap(({ value }) => Arr.ensure(value)),
    Arr.join("\n")
  );
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
