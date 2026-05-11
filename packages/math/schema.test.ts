import {
  MathDataSchema,
  MathRequestSchema,
  MathResultSchema,
} from "@repo/math/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("math schemas", () => {
  it("decodes a CAS request", () => {
    expect(
      Schema.decodeUnknownSync(MathRequestSchema)({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      })
    ).toEqual({
      expression: "2 + 2",
      kind: "math",
      operation: "evaluate",
    });
  });

  it("decodes CAS results and data parts", () => {
    const result = Schema.decodeUnknownSync(MathResultSchema)({
      conditions: [],
      input: {
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      },
      items: [],
      kind: "evaluate",
      operation: "evaluate",
      primary: {
        expression: "2 + 2",
        latex: "2 + 2",
      },
      reason: "Exact arithmetic was evaluated by SymPy.",
      secondary: {
        expression: "4",
        latex: "4",
      },
      stepStatus: "complete",
      steps: [
        {
          action: "evaluate",
          items: [],
          primary: {
            expression: "2 + 2",
            latex: "2 + 2",
          },
          relation: {
            expression: "equals",
            latex: "=",
          },
          secondary: {
            expression: "4",
            latex: "4",
          },
        },
      ],
      status: "verified",
    });

    expect(
      Schema.decodeUnknownSync(MathDataSchema)({
        input: result.input,
        kind: result.operation,
        result,
        status: result.status,
        summary: result.reason,
      })
    ).toMatchObject({
      kind: "evaluate",
      status: "verified",
    });
  });
});
