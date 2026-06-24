import {
  allowedPedagogyEvidenceRefs,
  buildPedagogyEvidencePacket,
  formatPedagogyEvidencePacket,
  hasEvidenceBoundSentences,
} from "@repo/ai/nina/pedagogy/evidence";
import type { MathWorkResultShape } from "@repo/math/schema/work";
import { describe, expect, it } from "vitest";

const EVIDENCE_HASH_PATTERN = /^evidence:/u;

describe("pedagogy evidence packet", () => {
  it("builds bounded deterministic refs from MathWork evidence", () => {
    const packet = buildPedagogyEvidencePacket({
      locale: "id",
      result: mathWorkFixture(),
    });
    const refs = allowedPedagogyEvidenceRefs(packet);

    expect(packet.workId).toBe("math:solve:pedagogy");
    expect(packet.evidenceHash).toMatch(EVIDENCE_HASH_PATTERN);
    expect(refs.has("math:solve:pedagogy:result:primary")).toBe(true);
    expect(refs.has("math:solve:pedagogy:verification:primary")).toBe(true);
    expect(refs.has("math:solve:pedagogy:step:0")).toBe(true);
    expect(refs.has("math:solve:pedagogy:assumption:variable")).toBe(true);
  });

  it("rejects sentence collections without evidence references", () => {
    expect(
      hasEvidenceBoundSentences([
        { evidenceRefs: ["math:solve:pedagogy:step:0"] },
      ])
    ).toBe(true);
    expect(hasEvidenceBoundSentences([{ evidenceRefs: [] }])).toBe(false);
  });

  it("formats empty semantic values without learner-facing fallback prose", () => {
    const result = mathWorkFixture();
    const packet = buildPedagogyEvidencePacket({
      locale: "en",
      result: {
        ...result,
        work: {
          ...result.work,
          limitations: [
            {
              copyKey: "math-limitation-cas-inconclusive",
              lane: "pedagogical",
              values: [],
            },
          ],
          verification: {
            ...result.work.verification,
            values: [],
          },
        },
      },
    });

    expect(formatPedagogyEvidencePacket(packet)).toContain("values=none");
  });
});

/** Builds one compact MathWork result with stable evidence refs. */
function mathWorkFixture(): MathWorkResultShape {
  return {
    artifacts: [],
    steps: [
      {
        input: { expression: "x^2 = 4", latex: "x^2 = 4" },
        order: 0,
        output: { expression: "[-2, 2]", latex: "\\left[-2,2\\right]" },
        projection: {
          advanced: {
            key: "math-step-solve",
            values: [
              { name: "evidenceRef", value: "math:solve:pedagogy:step:0" },
            ],
          },
          atomic: {
            key: "math-step-solve",
            values: [
              { name: "evidenceRef", value: "math:solve:pedagogy:step:0" },
            ],
          },
          professor: {
            key: "math-step-solve",
            values: [
              { name: "evidenceRef", value: "math:solve:pedagogy:step:0" },
            ],
          },
          school: {
            key: "math-step-solve",
            values: [
              { name: "evidenceRef", value: "math:solve:pedagogy:step:0" },
            ],
          },
        },
        projectionLevels: ["atomic", "school", "advanced", "professor"],
        ruleId: "cas.solve",
        verificationLane: "derived",
        workId: "math:solve:pedagogy",
      },
    ],
    work: {
      assumptions: [
        {
          copyKey: "math-assumption-variable",
          lane: "pedagogical",
          values: [
            {
              name: "evidenceRef",
              value: "math:solve:pedagogy:assumption:variable",
            },
            { name: "variable", value: "x" },
          ],
        },
      ],
      computations: [
        {
          conditions: [],
          input: {
            expression: "x^2 = 4",
            kind: "math",
            operation: "solve",
            variables: ["x"],
          },
          items: [],
          kind: "solve",
          operation: "solve",
          primary: { expression: "x^2 = 4", latex: "x^2 = 4" },
          secondary: {
            expression: "[-2, 2]",
            latex: "\\left[-2,2\\right]",
          },
          stepStatus: "complete",
          steps: [],
          status: "verified",
        },
      ],
      input: {
        givens: ["x^2 = 4"],
        kind: "prompt",
        locale: "id",
        objective: "solve",
        requirements: [],
        text: "solve",
      },
      limitations: [],
      plannedRequest: {
        expression: "x^2 = 4",
        kind: "math",
        operation: "solve",
        variables: ["x"],
      },
      primaryResult: {
        expression: "[-2, 2]",
        latex: "\\left[-2,2\\right]",
      },
      status: "ready",
      verification: {
        engine: "sympy",
        lane: "verified",
        reasonKey: "math-verification-verified",
        source: "cas.solve",
        values: [
          {
            name: "evidenceRef",
            value: "math:solve:pedagogy:verification:primary",
          },
        ],
      },
      workId: "math:solve:pedagogy",
    },
  };
}
