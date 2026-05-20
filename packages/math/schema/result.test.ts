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
    });
  });
});
