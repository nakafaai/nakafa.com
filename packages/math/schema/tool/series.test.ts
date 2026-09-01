import { describe, expect, it } from "@effect/vitest";
import { MathSeriesInputSchema } from "@repo/math/schema/tool/series";
import { Schema } from "effect";

describe("MathSeriesInputSchema", () => {
  it("accepts zero-order series requests", () => {
    expect(
      Schema.decodeSync(MathSeriesInputSchema)({
        expression: "exp(x)",
        operation: "series",
        order: 0,
      })
    ).toEqual({
      expression: "exp(x)",
      operation: "series",
      order: 0,
    });
  });

  it("rejects invalid series orders", () => {
    const decodeSeriesInput = Schema.decodeUnknownSync(MathSeriesInputSchema);

    expect(() =>
      decodeSeriesInput({
        expression: "exp(x)",
        operation: "series",
        order: -1,
      })
    ).toThrow();

    expect(() =>
      decodeSeriesInput({
        expression: "exp(x)",
        operation: "series",
        order: 1.5,
      })
    ).toThrow();
  });
});
