import { formulaExpressionForComputation } from "@repo/math/project/formula";
import type { MathCopyKey } from "@repo/math/schema/copy";
import { mathEvidenceRefValueName } from "@repo/math/schema/copy";
import type { VerificationLane } from "@repo/math/schema/lane";
import type { MathResult } from "@repo/math/schema/result";
import { MathWorkStep, type MathWorkStepShape } from "@repo/math/schema/step";

/** Derives canonical semantic MathWorkStep rows from CAS transport steps. */
export function deriveSteps({
  lane,
  result,
  workId,
}: {
  readonly lane: VerificationLane;
  readonly result: MathResult;
  readonly workId: string;
}) {
  return result.steps.map((step, index) =>
    deriveStep({ index, lane, result, step, workId })
  );
}

/** Derives one canonical MathWorkStep from a CAS step row. */
function deriveStep({
  index,
  lane,
  result,
  step,
  workId,
}: {
  readonly index: number;
  readonly lane: VerificationLane;
  readonly result: MathResult;
  readonly step: MathResult["steps"][number];
  readonly workId: string;
}) {
  const output = outputForStep({ result, step });
  const ruleId = ruleIdForAction(step.action);
  const evidenceRef = `${workId}:step:${index}`;

  return MathWorkStep.make({
    input: step.primary,
    order: index,
    output,
    projection: projectionForStep({
      action: step.action,
      evidenceRef,
      input: step.primary.expression,
      output: output.expression,
      ruleId,
    }),
    projectionLevels: ["atomic", "school", "advanced", "professor"],
    ruleId,
    verificationLane: lane,
    workId,
  });
}

/** Selects semantic step output while keeping solve results learner-readable. */
function outputForStep({
  result,
  step,
}: {
  readonly result: MathResult;
  readonly step: MathResult["steps"][number];
}) {
  if (!step.secondary) {
    return step.relation ?? step.primary;
  }

  return formulaExpressionForComputation({
    conditions: result.conditions,
    input: result.input,
    items: step.items,
    kind: result.kind,
    operation: result.operation,
    primary: step.primary,
    secondary: step.secondary,
    stepStatus: result.stepStatus,
    steps: [step],
    status: result.status,
  });
}

/** Converts a CAS action identifier into a stable MathWork rule id. */
function ruleIdForAction(action: string) {
  return `cas.${action.replaceAll("_", "-")}`;
}

/** Builds evidence-bound projection descriptors without embedding learner copy. */
function projectionForStep({
  action,
  evidenceRef,
  input,
  output,
  ruleId,
}: {
  readonly action: string;
  readonly evidenceRef: string;
  readonly input: string;
  readonly output: string;
  readonly ruleId: string;
}): MathWorkStepShape["projection"] {
  const key = stepCopyKeyForAction(action);
  const values = [
    { name: mathEvidenceRefValueName, value: evidenceRef },
    { name: "action", value: action },
    { name: "input", value: input },
    { name: "output", value: output },
    { name: "ruleId", value: ruleId },
  ];
  const copy = projectionCopy({ key, values });

  return {
    advanced: copy,
    atomic: copy,
    professor: copy,
    school: copy,
  };
}

/** Builds one projection level, omitting copy keys for unsupported actions. */
function projectionCopy({
  key,
  values,
}: {
  readonly key: MathCopyKey | undefined;
  readonly values: MathWorkStepShape["projection"]["school"]["values"];
}) {
  if (!key) {
    return { values };
  }

  return { key, values };
}

/** Maps deterministic CAS action ids to precise learner-copy keys. */
function stepCopyKeyForAction(action: string): MathCopyKey | undefined {
  const normalized = action.replaceAll("_", "-");

  if (normalized === "apart") {
    return "math-step-apart";
  }

  if (normalized === "cancel") {
    return "math-step-cancel";
  }

  if (normalized === "compare") {
    return "math-step-compare";
  }

  if (normalized === "differentiate") {
    return "math-step-differentiate";
  }

  if (normalized === "distance") {
    return "math-step-distance";
  }

  if (normalized === "evaluate") {
    return "math-step-evaluate";
  }

  if (normalized === "expand") {
    return "math-step-expand";
  }

  if (normalized === "factor") {
    return "math-step-factor";
  }

  if (normalized === "integrate") {
    return "math-step-integrate";
  }

  if (normalized === "integrate-sum") {
    return "math-step-integrate-sum";
  }

  if (normalized === "integrate-symmetry") {
    return "math-step-integrate-symmetry";
  }

  if (normalized === "rationalize") {
    return "math-step-rationalize";
  }

  if (normalized === "simplify") {
    return "math-step-simplify";
  }

  if (normalized === "solve") {
    return "math-step-solve";
  }

  if (normalized === "substitute") {
    return "math-step-substitute";
  }

  if (normalized === "together") {
    return "math-step-together";
  }

  return;
}
