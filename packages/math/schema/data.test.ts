import { MathDataSchema } from "@repo/math/schema/data";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathDataSchema", () => {
  it("decodes completed math data parts", () => {
    expect(
      Schema.decodeUnknownSync(MathDataSchema)({
        input: {
          expression: "2 + 2",
          kind: "math",
          operation: "evaluate",
        },
        kind: "evaluate",
        result: {
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
          stepStatus: "complete",
          steps: [],
          status: "verified",
        },
        status: "verified",
        summary: "Exact arithmetic was checked.",
      })
    ).toMatchObject({
      kind: "evaluate",
      status: "verified",
    });
  });
});
