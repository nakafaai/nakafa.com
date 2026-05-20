import { MathRequestSchema } from "@repo/math/schema/request";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathRequestSchema", () => {
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
});
