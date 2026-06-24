import { MathDataSchema } from "@repo/math/schema/data";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathDataSchema", () => {
  it("decodes loading and completed MathWork data parts", () => {
    expect(
      Schema.decodeUnknownSync(MathDataSchema)({
        input: {
          givens: ["x^2 - 1 = 0"],
          objective: "Solve the equation",
          request: "solve x^2 - 1 = 0",
        },
        status: "loading",
      })
    ).toMatchObject({
      status: "loading",
    });

    expect(
      Schema.decodeUnknownSync(MathDataSchema)({
        result: {
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
                stepStatus: "complete",
                steps: [],
                status: "verified",
              },
            ],
            createdAt: 1,
            input: {
              givens: ["x^2 - 1 = 0"],
              kind: "prompt",
              locale: "id",
              objective: "Solve the equation",
              text: "solve x^2 - 1 = 0",
            },
            limitations: [],
            plannedRequest: {
              expression: "x^2 - 1 = 0",
              kind: "math",
              operation: "solve",
            },
            primaryResult: {
              expression: "x^2 - 1 = 0",
              latex: "x^2 - 1 = 0",
            },
            status: "ready",
            verification: {
              engine: "sympy",
              lane: "verified",
              reasonKey: "math-verification-verified",
              source: "cas.solve",
              values: [],
            },
            workId: "mathwork_test",
          },
        },
        status: "done",
      })
    ).toMatchObject({
      result: {
        work: {
          status: "ready",
          verification: { lane: "verified" },
        },
      },
      status: "done",
    });
  });
});
