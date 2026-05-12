import {
  MathDataSchema,
  MathRequestSchema,
  MathResultSchema,
  MathToolInputSchema,
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
      reason: "Exact arithmetic was checked.",
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

  it("accepts strict compare tool input", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
        left: "(x^2 - 9)/(x - 3)",
        operation: "compare",
        right: "x + 3",
      })
    ).toEqual({
      left: "(x^2 - 9)/(x - 3)",
      operation: "compare",
      right: "x + 3",
    });
  });

  it("rejects strict algebra input without an expression", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        operation: "simplify",
      })
    ).toThrow();
  });

  it("requires exact point counts for geometry tool input", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
        operation: "distance",
        points: [
          { x: "1", y: "2" },
          { x: "4", y: "6" },
        ],
      })
    ).toEqual({
      operation: "distance",
      points: [
        { x: "1", y: "2" },
        { x: "4", y: "6" },
      ],
    });

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        operation: "distance",
        points: [{ x: "1", y: "2" }],
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        operation: "intersection",
        points: [
          { x: "0", y: "0" },
          { x: "1", y: "1" },
        ],
      })
    ).toThrow();
  });

  it("rejects malformed point coordinate strings before CAS execution", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        operation: "midpoint",
        points: [
          { x: "1", y: "2" },
          { x: "4,y:", y: "6" },
        ],
      })
    ).toThrow();
  });
});
