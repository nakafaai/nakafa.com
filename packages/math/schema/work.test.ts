import { MathReasoningRequest, MathWorkResult } from "@repo/math/schema/work";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathWork schemas", () => {
  it("decodes MathReasoning requests", () => {
    expect(
      Schema.decodeUnknownSync(MathReasoningRequest)({
        givens: ["x^2 - 5x + 6 = 0"],
        locale: "id",
        math: {
          expression: "x^2 - 5x + 6 = 0",
          kind: "math",
          operation: "solve",
          variables: ["x"],
        },
        objective: "Solve the equation",
        persistence: "persist",
        request: "solve x^2 - 5x + 6 = 0",
      })
    ).toMatchObject({
      locale: "id",
      math: {
        operation: "solve",
      },
      persistence: "persist",
    });
  });

  it("decodes full MathWork results", () => {
    expect(
      Schema.decodeUnknownSync(MathWorkResult)({
        artifacts: [],
        steps: [],
        work: {
          assumptions: [],
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
                latex: "\\left[-1, 1\\right]",
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
          limitations: [],
          plannedRequest: {
            expression: "x^2 - 1 = 0",
            kind: "math",
            operation: "solve",
          },
          primaryResult: {
            expression: "[-1, 1]",
            latex: "\\left[-1, 1\\right]",
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
      })
    ).toMatchObject({
      work: {
        verification: {
          lane: "verified",
        },
      },
    });
  });
});
