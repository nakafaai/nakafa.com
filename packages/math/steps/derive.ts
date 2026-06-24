import { formulaExpressionForComputation } from "@repo/math/project/formula";
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

  return MathWorkStep.make({
    input: step.primary,
    order: index,
    output,
    projection: projectionForStep({
      action: step.action,
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

/** Builds localized projection descriptors without embedding learner copy. */
function projectionForStep({
  action,
  input,
  output,
  ruleId,
}: {
  readonly action: string;
  readonly input: string;
  readonly output: string;
  readonly ruleId: string;
}): MathWorkStepShape["projection"] {
  const values = [
    { name: "action", value: action },
    { name: "input", value: input },
    { name: "output", value: output },
    { name: "ruleId", value: ruleId },
  ];

  return {
    advanced: { key: "math-step-advanced", values },
    atomic: { key: "math-step-atomic", values },
    professor: { key: "math-step-professor", values },
    school: { key: "math-step-school", values },
  };
}
