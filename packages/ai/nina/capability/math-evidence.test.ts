import {
  formatMathCapabilityEvidence,
  formatMathCapabilityFailure,
} from "@repo/ai/nina/capability/math-evidence";
import type { MathWorkResultShape } from "@repo/math/schema/work";
import { describe, expect, it } from "vitest";

describe("math evidence projection", () => {
  it("formats internal Nina evidence from semantic MathWork keys", () => {
    const evidence = formatMathCapabilityEvidence({
      result: checkedWork(),
    });

    expect(evidence).toContain("MathReasoning internal evidence");
    expect(evidence).toContain("A MathReasoning card has already been written");
    expect(evidence).toContain("reasonKey=math-verification-verified");
    expect(evidence).toContain("cas status: verified");
    expect(evidence).toContain("cas step status: partial");
    expect(evidence).toContain(
      "order=0; rule=cas.solve; lane=derived; input=x^2 - 1 = 0; output=[-1, 1]; schoolKey=math-step-solve"
    );
    expect(evidence).toContain("key=math-assumption-variable");
    expect(evidence).not.toContain("Checked with exact math");
  });

  it("formats live pedagogy as non-canonical evidence-bound context", () => {
    const evidence = formatMathCapabilityEvidence({
      pedagogy: {
        evidenceHash: "evidence:abc",
        kind: "math-pedagogy-projection",
        locale: "en",
        model: {
          gatewayModelId: "google/gemini-3-flash",
          modelId: "nakafa-lite",
          promptVersion: "math.pedagogy.v1",
          provider: "ai-gateway",
          schemaVersion: "pedagogy.projection.v1",
        },
        narratedAt: 1,
        sentences: [
          {
            evidenceRefs: ["math:solve:1:abc:step:0"],
            id: "math:solve:1:abc:pedagogy:0",
            text: "The equation is split into the solutions shown in the checked step.",
          },
        ],
        workId: "math:solve:1:abc",
      },
      result: checkedWork(),
    });

    expect(evidence).toContain("pedagogy projection:");
    expect(evidence).toContain("evidenceHash=evidence:abc");
    expect(evidence).toContain("refs=math:solve:1:abc:step:0");
  });

  it("formats contradicted CAS status without hiding the mismatch", () => {
    const evidence = formatMathCapabilityEvidence({
      result: contradictedWork(),
    });

    expect(evidence).toContain("cas status: contradicted");
    expect(evidence).toContain("reasonKey=math-verification-contradicted");
    expect(evidence).toContain("result expression: x + 2");
  });

  it("formats missing-step evidence without UI dictionary copy", () => {
    const evidence = formatMathCapabilityEvidence({
      result: minimalWork(),
    });

    expect(evidence).toContain("steps: unavailable");
    expect(evidence).toContain("Do not expose this internal evidence block");
    expect(evidence).not.toContain("How to get there");
  });

  it("omits CAS status rows when computation evidence is unavailable", () => {
    const evidence = formatMathCapabilityEvidence({
      result: noComputationWork(),
    });

    expect(evidence).not.toContain("cas status:");
    expect(evidence).toContain("steps: unavailable");
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
          advanced: {
            key: "math-step-solve",
            values: [{ name: "evidenceRef", value: "math:solve:1:abc:step:0" }],
          },
          atomic: {
            key: "math-step-solve",
            values: [{ name: "evidenceRef", value: "math:solve:1:abc:step:0" }],
          },
          professor: {
            key: "math-step-solve",
            values: [{ name: "evidenceRef", value: "math:solve:1:abc:step:0" }],
          },
          school: {
            key: "math-step-solve",
            values: [{ name: "evidenceRef", value: "math:solve:1:abc:step:0" }],
          },
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
          copyKey: "math-assumption-variable",
          lane: "pedagogical",
          values: [
            { name: "evidenceRef", value: "math:solve:1:abc:assumption:0" },
            { name: "variable", value: "x" },
          ],
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
      input: {
        givens: ["x^2 - 1 = 0"],
        kind: "prompt",
        locale: "id",
        objective: "Solve",
        requirements: [],
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

/** Builds a MathWork fixture for exact checks that disprove a claim. */
function contradictedWork(): MathWorkResultShape {
  const work = checkedWork();

  return {
    ...work,
    work: {
      ...work.work,
      computations: [
        {
          ...work.work.computations[0],
          secondary: {
            expression: "x + 2",
            latex: "x+2",
          },
          status: "contradicted",
        },
      ],
      primaryResult: {
        expression: "x + 2",
        latex: "x+2",
      },
      verification: {
        ...work.work.verification,
        reasonKey: "math-verification-contradicted",
      },
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

/** Builds a MathWork fixture without computation rows. */
function noComputationWork(): MathWorkResultShape {
  const work = minimalWork();

  return {
    ...work,
    work: {
      ...work.work,
      computations: [],
    },
  };
}
