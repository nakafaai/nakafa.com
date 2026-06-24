import type { MathResult } from "@repo/math/schema/result";
import { deriveSteps } from "@repo/math/steps/derive";
import { describe, expect, it } from "vitest";

describe("deriveSteps", () => {
  it("uses secondary, relation, then primary expressions as step output", () => {
    const steps = deriveSteps({
      lane: "derived",
      result: {
        ...mathResult(),
        steps: [
          casStep("expand_terms", {
            secondary: { expression: "2*x", latex: "2x" },
          }),
          casStep("relate", {
            relation: { expression: "=", latex: "=" },
          }),
          casStep("inspect", {}),
        ],
      },
      workId: "math:steps:test",
    });

    expect(steps.map((step) => step.output.expression)).toEqual([
      "2*x",
      "=",
      "x",
    ]);
    expect(steps[0]?.ruleId).toBe("cas.expand-terms");
    expect(steps[0]?.projection.school.values).toEqual(
      expect.arrayContaining([{ name: "ruleId", value: "cas.expand-terms" }])
    );
  });

  it("projects solve step output as an equation instead of a raw solution list", () => {
    const steps = deriveSteps({
      lane: "derived",
      result: {
        ...mathResult(),
        input: {
          expression: "x + 2 = 5",
          kind: "math",
          operation: "solve",
          variables: ["x"],
        },
        kind: "solve",
        operation: "solve",
        steps: [
          casStep("solve", {
            primary: { expression: "x + 2 = 5", latex: "x + 2 = 5" },
            secondary: { expression: "[3]", latex: "\\left[3\\right]" },
          }),
        ],
      },
      workId: "math:steps:solve",
    });

    expect(steps[0]?.output).toEqual({
      expression: "x = 3",
      latex: "x = 3",
    });
  });

  it("maps every supported CAS action to a semantic copy key", () => {
    const actions = [
      "apart",
      "cancel",
      "compare",
      "differentiate",
      "distance",
      "evaluate",
      "expand",
      "factor",
      "integrate",
      "integrate_sum",
      "integrate_symmetry",
      "rationalize",
      "simplify",
      "solve",
      "substitute",
      "together",
      "unsupported",
    ];
    const steps = deriveSteps({
      lane: "derived",
      result: {
        ...mathResult(),
        steps: actions.map((action) => casStep(action, {})),
      },
      workId: "math:steps:actions",
    });

    expect(steps.map((step) => step.projection.school.key)).toEqual([
      "math-step-apart",
      "math-step-cancel",
      "math-step-compare",
      "math-step-differentiate",
      "math-step-distance",
      "math-step-evaluate",
      "math-step-expand",
      "math-step-factor",
      "math-step-integrate",
      "math-step-integrate-sum",
      "math-step-integrate-symmetry",
      "math-step-rationalize",
      "math-step-simplify",
      "math-step-solve",
      "math-step-substitute",
      "math-step-together",
      undefined,
    ]);
    expect(steps.at(-1)?.projection.school.values).toEqual(
      expect.arrayContaining([{ name: "action", value: "unsupported" }])
    );
  });
});

/** Builds a CAS step with optional secondary or relation output evidence. */
function casStep(
  action: string,
  output: Partial<MathResult["steps"][number]>
): MathResult["steps"][number] {
  return {
    action,
    items: [],
    primary: { expression: "x", latex: "x" },
    ...output,
  };
}

/** Builds a minimal CAS result fixture for step derivation tests. */
function mathResult(): MathResult {
  return {
    conditions: [],
    input: {
      expression: "x",
      kind: "math",
      operation: "simplify",
    },
    items: [],
    kind: "simplify",
    operation: "simplify",
    primary: { expression: "x", latex: "x" },
    reason: "checked",
    stepStatus: "complete",
    steps: [],
    status: "verified",
  };
}
