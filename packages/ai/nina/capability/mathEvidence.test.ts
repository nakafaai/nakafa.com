import {
  formatMathCapabilityEvidence,
  formatMathCapabilityFailure,
} from "@repo/ai/nina/capability/mathEvidence";
import type { MathWorkResultShape } from "@repo/math/schema/work";
import { describe, expect, it } from "vitest";

describe("math evidence projection", () => {
  it("formats internal Nina evidence from semantic MathWork keys", () => {
    const evidence = formatMathCapabilityEvidence({
      result: checkedWork(),
    });

    expect(evidence).toContain("MathReasoning internal evidence");
    expect(evidence).toContain("reasonKey=math-verification-verified");
    expect(evidence).toContain("key=math-assumption-planned-from-prompt");
    expect(evidence).not.toContain("Checked with exact math");
  });

  it("formats missing-step evidence without UI dictionary copy", () => {
    const evidence = formatMathCapabilityEvidence({
      result: minimalWork(),
    });

    expect(evidence).toContain("steps: unavailable");
    expect(evidence).toContain("Do not expose this internal evidence block");
    expect(evidence).not.toContain("How to get there");
  });

  it("formats failed math evidence as internal prompt-only context", () => {
    const evidence = formatMathCapabilityFailure();

    expect(evidence).toContain("MathReasoning unavailable");
    expect(evidence).toContain("evidence returned: none");
    expect(evidence).toContain("Do not expose this internal status block");
  });
});

/** Builds a MathWork fixture that exercises secondary results, notes, and steps. */
function checkedWork(): MathWorkResultShape {
  return {
    artifacts: [
      {
        artifactId: "math:solve:1:abc:formula",
        kind: "formula-card",
        manifest: {
          expressionRefs: ["primaryResult"],
          kind: "formula-card",
        },
        titleKey: "math-solve",
        verificationLane: "verified",
        workId: "math:solve:1:abc",
      },
    ],
    steps: [
      {
        input: {
          expression: "x^2 - 1 = 0",
          latex: "x^2 - 1 = 0",
        },
        order: 0,
        output: {
          expression: "[-1, 1]",
          latex: "\\left[-1,1\\right]",
        },
        projection: {
          advanced: { key: "math-step-advanced", values: [] },
          atomic: { key: "math-step-atomic", values: [] },
          professor: { key: "math-step-professor", values: [] },
          school: { key: "math-step-school", values: [] },
        },
        projectionLevels: ["atomic", "school", "advanced", "professor"],
        ruleId: "cas.solve",
        verificationLane: "derived",
        workId: "math:solve:1:abc",
      },
    ],
    work: {
      assumptions: [
        {
          copyKey: "math-assumption-planned-from-prompt",
          lane: "pedagogical",
          values: [],
        },
      ],
      computations: [
        {
          conditions: [],
          input: {
            expression: "x^2 - 1 = 0",
            kind: "math",
            operation: "solve",
          },
          items: [],
          kind: "solve",
          operation: "solve",
          primary: {
            expression: "x^2 - 1 = 0",
            latex: "x^2 - 1 = 0",
          },
          secondary: {
            expression: "[-1, 1]",
            latex: "\\left[-1,1\\right]",
          },
          stepStatus: "partial",
          steps: [],
          status: "verified",
        },
      ],
      createdAt: 1,
      input: {
        givens: ["x^2 - 1 = 0"],
        kind: "prompt",
        locale: "id",
        objective: "Solve",
        text: "solve x^2 - 1 = 0",
      },
      limitations: [
        {
          copyKey: "math-limitation-cas-inconclusive",
          lane: "speculative",
          source: "cas.solve",
          values: [{ name: "operation", value: "solve" }],
        },
      ],
      plannedRequest: {
        expression: "x^2 - 1 = 0",
        kind: "math",
        operation: "solve",
      },
      primaryResult: {
        expression: "[-1, 1]",
        latex: "\\left[-1,1\\right]",
      },
      status: "ready",
      verification: {
        engine: "sympy",
        lane: "verified",
        reasonKey: "math-verification-verified",
        source: "cas.solve",
        values: [],
      },
      workId: "math:solve:1:abc",
    },
  };
}

/** Builds a MathWork fixture that exercises empty notes and unavailable steps. */
function minimalWork(): MathWorkResultShape {
  const work = checkedWork();

  return {
    artifacts: [],
    steps: [],
    work: {
      ...work.work,
      assumptions: [],
      limitations: [],
      computations: [
        {
          ...work.work.computations[0],
          secondary: undefined,
        },
      ],
    },
  };
}
