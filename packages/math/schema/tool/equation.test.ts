import { describe, expect, it } from "@effect/vitest";
import { MathEquationInputSchema } from "@repo/math/schema/tool/equation";
import { Schema } from "effect";

describe("MathEquationInputSchema", () => {
  const decodeEquationInput = Schema.decodeUnknownSync(MathEquationInputSchema);

  it("accepts single-equation solve domains", () => {
    expect(
      decodeEquationInput({
        expression: "x^x * (ln(x) + 1) = 0",
        lower: "0",
        lowerInclusive: false,
        operation: "solve",
        variable: "x",
      })
    ).toEqual({
      expression: "x^x * (ln(x) + 1) = 0",
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
    });
  });

  it("rejects root requests with solve-domain bounds", () => {
    expect(() =>
      decodeEquationInput({
        expression: "x^2 - 1 = 0",
        lower: "0",
        operation: "roots",
        variable: "x",
      })
    ).toThrow();
  });

  it("accepts bounded system domains with a domain variable", () => {
    expect(
      decodeEquationInput({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        lower: "0",
        lowerInclusive: false,
        operation: "solve",
        variable: "x",
        variables: ["x", "y"],
      })
    ).toEqual({
      expressions: ["x^2 - 1 = 0", "y = 0"],
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
      variables: ["x", "y"],
    });
  });

  it("accepts unbounded systems without a domain variable", () => {
    expect(
      decodeEquationInput({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        operation: "solve",
        variables: ["x", "y"],
      })
    ).toEqual({
      expressions: ["x^2 - 1 = 0", "y = 0"],
      operation: "solve",
      variables: ["x", "y"],
    });
  });

  it("rejects bounded systems without a domain variable", () => {
    expect(() =>
      decodeEquationInput({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        lower: "0",
        lowerInclusive: false,
        operation: "solve",
        variables: ["x", "y"],
      })
    ).toThrow();

    expect(() =>
      decodeEquationInput({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        operation: "solve",
        upper: "2",
        upperInclusive: false,
        variables: ["x", "y"],
      })
    ).toThrow();
  });

  it("rejects bounded systems without full solved variables", () => {
    expect(() =>
      decodeEquationInput({
        expressions: ["x + y = 3", "y = 1"],
        lower: "0",
        operation: "solve",
        variable: "x",
      })
    ).toThrow();

    expect(() =>
      decodeEquationInput({
        expressions: ["x = 2", "y = 1"],
        lower: "0",
        operation: "solve",
        variable: "x",
        variables: ["x"],
      })
    ).toThrow();

    expect(() =>
      decodeEquationInput({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        lower: "0",
        operation: "solve",
        variable: "z",
        variables: ["x", "y"],
      })
    ).toThrow();
  });

  it("accepts bounded systems with symbolic parameters", () => {
    expect(
      decodeEquationInput({
        expressions: ["a*x = 1"],
        lower: "0",
        lowerInclusive: false,
        operation: "solve",
        variable: "x",
        variables: ["x"],
      })
    ).toEqual({
      expressions: ["a*x = 1"],
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
      variables: ["x"],
    });
  });

  it("accepts bounded systems with supported parser functions", () => {
    expect(
      decodeEquationInput({
        expressions: ["Rational(1, 2)*x = 1"],
        lower: "0",
        operation: "solve",
        variable: "x",
        variables: ["x"],
      })
    ).toEqual({
      expressions: ["Rational(1, 2)*x = 1"],
      lower: "0",
      operation: "solve",
      variable: "x",
      variables: ["x"],
    });
  });
});
