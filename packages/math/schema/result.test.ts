import { MathResultSchema } from "@repo/math/schema/result";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathResultSchema", () => {
  it("decodes a CAS result", () => {
    expect(
      Schema.decodeUnknownSync(MathResultSchema)({
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
            reason: "Evaluate the exact arithmetic expression.",
            secondary: {
              expression: "4",
              latex: "4",
            },
          },
        ],
        status: "verified",
      })
    ).toMatchObject({
      kind: "evaluate",
      status: "verified",
      steps: [
        expect.objectContaining({
          reason: "Evaluate the exact arithmetic expression.",
        }),
      ],
    });
  });

  it("decodes null and omitted step reasons", () => {
    const decoded = Schema.decodeUnknownSync(MathResultSchema)({
      conditions: [],
      input: {
        kind: "math",
        modulus: "30",
        n: "84",
        operation: "modular",
      },
      items: [],
      kind: "modular",
      operation: "modular",
      primary: {
        expression: "84 mod 30",
        latex: "84 \\bmod 30",
      },
      reason: "The discrete math operation was checked exactly.",
      secondary: {
        expression: "24",
        latex: "24",
      },
      stepStatus: "complete",
      steps: [
        {
          action: "modular",
          items: [
            {
              label: "division",
              latex: "84 = 2 \\cdot 30 + 24",
              value: "84 = 2*30 + 24",
            },
          ],
          primary: {
            expression: "84 mod 30",
            latex: "84 \\bmod 30",
          },
          reason: null,
          relation: {
            expression: "equals",
            latex: "=",
          },
          secondary: {
            expression: "24",
            latex: "24",
          },
        },
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

    expect(decoded.steps[0]?.reason).toBeNull();
    expect(decoded.steps[1]?.reason).toBeUndefined();
  });
});
