import { MathCalculusInputSchema } from "@repo/math/schema/tool/calculus";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathCalculusInputSchema", () => {
  const decodeCalculusInput = Schema.decodeUnknownSync(MathCalculusInputSchema);

  it("requires variables for expressions with parameters", () => {
    expect(
      decodeCalculusInput({
        expression: "sin(x) + exp(-x)",
        operation: "integrate",
      })
    ).toEqual({
      expression: "sin(x) + exp(-x)",
      operation: "integrate",
    });

    expect(() =>
      decodeCalculusInput({
        expression: "x^(a-1) * exp(-x)",
        lower: "0",
        operation: "integrate",
        upper: "oo",
      })
    ).toThrow();

    expect(
      decodeCalculusInput({
        expression: "x^(a-1) * exp(-x)",
        lower: "0",
        operation: "integrate",
        upper: "oo",
        variable: "x",
      })
    ).toEqual({
      expression: "x^(a-1) * exp(-x)",
      lower: "0",
      operation: "integrate",
      upper: "oo",
      variable: "x",
    });
  });

  it("accepts derivative order only for differentiation", () => {
    expect(
      decodeCalculusInput({
        expression: "x^x",
        operation: "differentiate",
        order: 2,
        variable: "x",
      })
    ).toEqual({
      expression: "x^x",
      operation: "differentiate",
      order: 2,
      variable: "x",
    });

    expect(() =>
      decodeCalculusInput({
        expression: "x^x",
        operation: "differentiate",
        order: 0,
        variable: "x",
      })
    ).toThrow();

    expect(() =>
      decodeCalculusInput({
        expression: "x^2",
        operation: "integrate",
        order: 2,
        variable: "x",
      })
    ).toThrow();

    expect(() =>
      decodeCalculusInput({
        expression: "sin(x) / x",
        operation: "limit",
        order: 2,
        point: "0",
        variable: "x",
      })
    ).toThrow();
  });
});
