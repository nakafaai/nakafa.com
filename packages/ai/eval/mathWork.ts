import type { MathWorkResultShape } from "@repo/math/schema/work";

/** Creates semantic MathWork evidence used by the deterministic eval suite. */
export function createMathEvalWork(): MathWorkResultShape {
  return {
    artifacts: [
      {
        artifactId: "math:solve:eval:formula",
        kind: "formula-card",
        manifest: {
          expressionRefs: ["primaryResult"],
          kind: "formula-card",
        },
        titleKey: "math-solve",
        verificationLane: "verified",
        workId: "math:solve:eval",
      },
    ],
    steps: [
      {
        input: {
          expression: "x + 2 = 5",
          latex: "x + 2 = 5",
        },
        order: 0,
        output: {
          expression: "x = 3",
          latex: "x = 3",
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
        workId: "math:solve:eval",
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
            expression: "x + 2 = 5",
            kind: "math",
            operation: "solve",
            variables: ["x"],
          },
          items: [],
          kind: "solve",
          operation: "solve",
          primary: {
            expression: "x + 2 = 5",
            latex: "x + 2 = 5",
          },
          secondary: {
            expression: "x = 3",
            latex: "x = 3",
          },
          stepStatus: "complete",
          steps: [],
          status: "verified",
        },
      ],
      createdAt: 1,
      input: {
        givens: ["x + 2 = 5"],
        kind: "prompt",
        locale: "id",
        objective: "solve",
        text: "solve x + 2 = 5",
      },
      limitations: [],
      plannedRequest: {
        expression: "x + 2 = 5",
        kind: "math",
        operation: "solve",
        variables: ["x"],
      },
      primaryResult: {
        expression: "x = 3",
        latex: "x = 3",
      },
      status: "ready",
      verification: {
        engine: "sympy",
        lane: "verified",
        reasonKey: "math-verification-verified",
        source: "cas.solve",
        values: [],
      },
      workId: "math:solve:eval",
    },
  };
}
