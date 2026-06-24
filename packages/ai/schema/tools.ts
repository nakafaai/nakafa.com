import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { createPrompt } from "@repo/ai/prompt/utils";
import { mathReasoningOperations } from "@repo/math/schema/operations";
import { type MathRequest, MathRequestSchema } from "@repo/math/schema/request";
import { type InferUITools, tool } from "ai";
import { Schema } from "effect";

const SpecialistToolInputFields = {
  request: Schema.NonEmptyString.annotations({
    description: createPrompt({
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
    }),
  }),
  objective: Schema.NonEmptyString.annotations({
    description: createPrompt({
      taskContext: `
        Specialist job only.

        State what evidence, retrieval, or verification is needed.
        Do not include final-answer wording.
        Do not include instructions for weak, missing, or failed outcomes.
      `,
    }),
  }),
  requirements: Schema.optional(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable)
  ).annotations({
    description: createPrompt({
      taskContext: `
        Real constraints only.

        Include locale, current page, source ownership, recency, variables,
        assumptions, or requested evidence only when they matter.
        For math, include user-stated domain restrictions and inequalities
        when they are not already represented in math.lower/math.upper fields.
        Do not include general answer-formatting, persona, or style rules.
        Do not include empty, fallback, or outcome-dependent instructions.
      `,
    }),
  }),
};

const mathToolRequestDescription = createPrompt({
  taskContext: `
    Structured deterministic math request.

    Use schema operation ids and exact math fields only.
    Supported operations are solve, simplify, factor, differentiate,
    integrate, line, and circle.
    Solve requests must include expression or non-empty expressions.
    Algebra and calculus requests must include expression.
    Line requests must include exactly two points.
    Circle requests must include exactly two points and pointSemantics
    circle-radius-point.
    Put expressions, systems, variables, bounds, derivative order,
    matrices, values, or points in the matching fields. For circle
    requests, provide points in center/radius-point order and set
    pointSemantics to circle-radius-point.
    For solve domain restrictions, set variable/variables plus lower,
    upper, lowerInclusive, or upperInclusive instead of leaving the
    restriction only in request, objective, or given.
    If a direct calculation request contains an incomplete expression, preserve
    that expression exactly in expression so MathReasoning can fail typed.
    Do not put natural-language commands, deliverable wording, or
    explanation text in this structured object.
  `,
});

const MathToolRequestSchema = MathRequestSchema.pipe(
  Schema.filter(isValidMathToolRequest, {
    message: mathToolRequestValidationMessage,
  })
).annotations({
  description: mathToolRequestDescription,
});

/** Checks support and required fields in one AI SDK tool validation pass. */
function isValidMathToolRequest(request: MathRequest) {
  const supported = isSupportedMathReasoningRequest(request);
  const hasRequiredFields = hasRequiredMathToolFields(request);
  return supported && hasRequiredFields;
}

/** Builds the provider-visible validation reason for repaired math tool calls. */
function mathToolRequestValidationMessage() {
  return "Math tool requests must use first-slice MathReasoning operations and include the operation-specific structured fields.";
}

/** Keeps Nina math tool calls inside the first production MathReasoning slice. */
function isSupportedMathReasoningRequest(request: MathRequest) {
  return mathReasoningOperations.some(
    (operation) => operation === request.operation
  );
}

/** Validates operation-specific structured fields before tool-call execution. */
function hasRequiredMathToolFields(request: MathRequest) {
  if (request.operation === "solve") {
    return hasExpressionOrExpressions(request);
  }

  if (
    request.operation === "factor" ||
    request.operation === "simplify" ||
    request.operation === "differentiate" ||
    request.operation === "integrate"
  ) {
    return Boolean(request.expression);
  }

  if (request.operation === "line") {
    return (request.points ?? []).length === 2;
  }

  if (request.operation === "circle") {
    return (
      request.pointSemantics === "circle-radius-point" &&
      (request.points ?? []).length === 2
    );
  }

  return false;
}

/** Returns whether a request has at least one structured solve relation. */
function hasExpressionOrExpressions(request: MathRequest) {
  return Boolean(request.expression) || (request.expressions ?? []).length > 0;
}

/**
 * Input schema for the Nakafa LearningCapability tool.
 */
export const NakafaToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  deliverables: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
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
  .pipe(Schema.mutable)
  .annotations({
    description: createPrompt({
      taskContext: `
        Nakafa content retrieval request.
      `,
    }),
  });

/**
 * Input schema for the deep research LearningCapability tool.
 */
export const ResearchToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  sourceRequirements: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description: createPrompt({
        taskContext: `
        Source requirements only.

        Include source ownership, recency, domain, URL, or credibility
        requirements. Do not include final-answer wording.
      `,
      }),
    }),
})
  .pipe(Schema.mutable)
  .annotations({
    description: createPrompt({
      taskContext: `
        External research request.
      `,
    }),
  });

/**
 * Input schema for the deterministic math LearningCapability tool.
 */
export const MathToolInputSchema = Schema.Struct({
  ...SpecialistToolInputFields,
  given: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description: createPrompt({
        taskContext: `
          Math givens only.

          Include expressions, equations, variables, assumptions, matrices,
          data, selected exercise content, or answer keys that must be checked.
          Preserve user-stated math constraints, but prefer the structured
          math fields for domain bounds when they are available.
          Do not add derived formulas or solution methods unless they come from
          the user or retrieved evidence being verified.
        `,
      }),
    }),
  math: Schema.propertySignature(MathToolRequestSchema).annotations({
    description: mathToolRequestDescription,
  }),
})
  .pipe(Schema.mutable)
  .annotations({
    description: createPrompt({
      taskContext: `
        Deterministic math verification request.
      `,
    }),
  });

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
    "math" in input ? formatJsonSection("Math", input.math) : "",
  ].filter(Boolean);

  return createPrompt({
    taskContext: sections.join("\n\n"),
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

      ${items.map((item) => `- ${item}`).join("\n")}
    `,
  });
}

/** Formats a structured specialist payload as compact internal JSON. */
function formatJsonSection(heading: string, value: object) {
  return createPrompt({
    taskContext: `
      # ${heading}

      ${JSON.stringify(value)}
    `,
  });
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
