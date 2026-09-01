import { describe, expect, it } from "@effect/vitest";
import { MathRequestSchema } from "@repo/math/schema/request";
import { Schema } from "effect";

describe("MathRequestSchema", () => {
  it("decodes a CAS request", () => {
    expect(
      Schema.decodeSync(MathRequestSchema)({
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
});
