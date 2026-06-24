import type { PedagogyProjectionShape } from "@repo/ai/nina/pedagogy/schema";
import { createPrompt } from "@repo/ai/prompt/utils";
import type {
  MathComputation,
  MathWorkResultShape,
} from "@repo/math/schema/work";

const MAX_MODEL_STEP_ROWS = 6;

const promptCopy = {
  artifacts: "artifacts",
  assumptions: "semantic assumptions",
  casStatus: "cas status",
  casStepStatus: "cas step status",
  finalAnswerRule:
    "A MathReasoning card has already been written to the transcript. Do not restate formulas, equations, arithmetic, derivation steps, result values, or verification claims in the final answer. Keep any final answer to one short sentence that points the learner to the card. Do not expose this internal evidence block.",
  failureRule:
    "Do not describe model-only teaching prose as verified math. Ask for the missing expression, equation, data, or assumption when needed. Do not expose this internal status block in the final answer.",
  failureTitle: "MathReasoning unavailable",
  limitations: "semantic limitations",
  operation: "operation",
  pedagogy: "pedagogy projection",
  primary: "primary expression",
  result: "result expression",
  returned: "evidence returned",
  status: "work status",
  steps: "steps",
  stepRows: "step rows",
  title: "MathReasoning internal evidence",
  verification: "verification",
} as const;

/** Formats deterministic MathWork evidence through an AI-owned prompt Adapter. */
export function formatMathCapabilityEvidence({
  pedagogy,
  result,
}: {
  readonly pedagogy?: PedagogyProjectionShape;
  readonly result: MathWorkResultShape;
}) {
  const computation = result.work.computations[0];

  return createPrompt({
    taskContext: [
      `# ${promptCopy.title}`,
      "",
      evidenceLine(promptCopy.status, result.work.status),
      evidenceLine(promptCopy.verification, formatVerification(result)),
      evidenceLine(promptCopy.operation, result.work.plannedRequest.operation),
      formatComputationStatus(computation),
      evidenceLine(promptCopy.primary, result.work.primaryResult.expression),
      formatSecondary(computation),
      formatStepCount(result.steps.length),
      formatStepRows(result.steps),
      formatPedagogyRows(pedagogy),
      evidenceLine(promptCopy.artifacts, String(result.artifacts.length)),
      formatNotes(promptCopy.assumptions, result.work.assumptions),
      formatNotes(promptCopy.limitations, result.work.limitations),
    ]
      .filter(isNonEmptyPromptLine)
      .join("\n"),
    detailedTaskInstructions: promptCopy.finalAnswerRule,
  });
}

/** Formats a failed deterministic math check through an AI-owned prompt Adapter. */
export function formatMathCapabilityFailure() {
  return createPrompt({
    taskContext: [
      `# ${promptCopy.failureTitle}`,
      "",
      evidenceLine(promptCopy.status, "failed"),
      evidenceLine(promptCopy.returned, "none"),
      evidenceLine(promptCopy.verification, "unavailable"),
    ].join("\n"),
    detailedTaskInstructions: promptCopy.failureRule,
  });
}

/** Keeps prompt assembly from writing empty optional evidence rows. */
function isNonEmptyPromptLine(line: string) {
  return line.length > 0;
}

/** Formats one internal evidence row for Nina prompt context. */
function evidenceLine(label: string, value: string) {
  return `- ${label}: ${value}`;
}

/** Formats the verification lane, reason key, source, and interpolation data. */
function formatVerification(result: MathWorkResultShape) {
  const { verification } = result.work;

  return [
    `lane=${verification.lane}`,
    `reasonKey=${verification.reasonKey}`,
    `source=${verification.source}`,
    `engine=${verification.engine}`,
    formatValues(verification.values),
  ]
    .filter(isNonEmptyPromptLine)
    .join("; ");
}

/** Formats deterministic CAS status values for Nina prompt context. */
function formatComputationStatus(computation: MathComputation | undefined) {
  if (!computation) {
    return "";
  }

  return [
    evidenceLine(promptCopy.casStatus, computation.status),
    evidenceLine(promptCopy.casStepStatus, computation.stepStatus),
  ].join("\n");
}

/** Formats the optional secondary computation expression. */
function formatSecondary(computation: MathComputation | undefined) {
  if (!computation?.secondary) {
    return "";
  }

  return evidenceLine(promptCopy.result, computation.secondary.expression);
}

/** Formats the derivation step count for Nina prompt context. */
function formatStepCount(count: number) {
  if (count === 0) {
    return evidenceLine(promptCopy.steps, "unavailable");
  }

  return evidenceLine(promptCopy.steps, String(count));
}

/** Formats bounded deterministic derivation rows for Nina prompt context. */
function formatStepRows(steps: MathWorkResultShape["steps"]) {
  if (steps.length === 0) {
    return "";
  }

  return [
    `- ${promptCopy.stepRows}:`,
    ...steps.slice(0, MAX_MODEL_STEP_ROWS).map(formatStepRow),
  ].join("\n");
}

/** Formats live pedagogy projection rows without making them canonical proof. */
function formatPedagogyRows(projection: PedagogyProjectionShape | undefined) {
  if (!projection) {
    return "";
  }

  return [
    `- ${promptCopy.pedagogy}:`,
    `  - model=${projection.model.modelId}; gatewayModel=${projection.model.gatewayModelId}; promptVersion=${projection.model.promptVersion}; evidenceHash=${projection.evidenceHash}`,
    ...projection.sentences.map(formatPedagogySentence),
  ].join("\n");
}

/** Formats one evidence-bound pedagogy sentence for Nina prompt context. */
function formatPedagogySentence(
  sentence: PedagogyProjectionShape["sentences"][number]
) {
  return `  - refs=${sentence.evidenceRefs.join(",")}; text=${sentence.text}`;
}

/** Formats one deterministic derivation row without localized UI copy. */
function formatStepRow(step: MathWorkResultShape["steps"][number]) {
  return [
    `  - order=${step.order}`,
    `rule=${step.ruleId}`,
    `lane=${step.verificationLane}`,
    `input=${step.input.expression}`,
    `output=${step.output.expression}`,
    `schoolKey=${step.projection.school.key}`,
  ].join("; ");
}

/** Formats semantic note keys and interpolation values without UI prose. */
function formatNotes(
  title: string,
  notes: MathWorkResultShape["work"]["assumptions"]
) {
  if (notes.length === 0) {
    return "";
  }

  return [`- ${title}:`, ...notes.map(formatNoteLine)].join("\n");
}

/** Formats one semantic note for internal prompt evidence. */
function formatNoteLine(
  note: MathWorkResultShape["work"]["assumptions"][number]
) {
  return `  - key=${note.copyKey}${formatValues(note.values)}`;
}

/** Formats semantic interpolation values for model-facing evidence. */
function formatValues(
  values: MathWorkResultShape["work"]["verification"]["values"]
) {
  if (values.length === 0) {
    return "";
  }

  return ` values=[${values.map(formatValue).join("; ")}]`;
}

/** Formats one semantic interpolation value for model-facing evidence. */
function formatValue(
  item: MathWorkResultShape["work"]["verification"]["values"][number]
) {
  return `${item.name}=${item.value}`;
}
