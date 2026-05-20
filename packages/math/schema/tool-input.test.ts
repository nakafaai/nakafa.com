import { MathToolInputSchema } from "@repo/math/schema/tool-input";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathToolInputSchema", () => {
  it("accepts zero-order series requests but rejects invalid series orders", () => {
    const decodeMathToolInput = Schema.decodeUnknownSync(MathToolInputSchema);

    expect(
      decodeMathToolInput({
        expression: "exp(x)",
        operation: "series",
        order: 0,
      })
    ).toEqual({
      expression: "exp(x)",
      operation: "series",
      order: 0,
    });

    expect(() =>
      decodeMathToolInput({
        expression: "exp(x)",
        operation: "series",
        order: -1,
      })
    ).toThrow();

    expect(() =>
      decodeMathToolInput({
        expression: "exp(x)",
        operation: "series",
        order: 1.5,
      })
    ).toThrow();
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

  it("accepts equation solve domains", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
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

  it("accepts bounded system domains with a domain variable", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
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

  it("rejects root requests with solve-domain bounds", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        expression: "x^2 - 1 = 0",
        lower: "0",
        operation: "roots",
        variable: "x",
      })
    ).toThrow();
  });

  it("accepts unbounded systems without a domain variable", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
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

  it("rejects bounded system domains without a domain variable", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        lower: "0",
        lowerInclusive: false,
        operation: "solve",
        variables: ["x", "y"],
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        expressions: ["x^2 - 1 = 0", "y = 0"],
        operation: "solve",
        upper: "2",
        upperInclusive: false,
        variables: ["x", "y"],
      })
    ).toThrow();
  });

  it("rejects bounded system domains without full solved variables", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        expressions: ["x + y = 3", "y = 1"],
        lower: "0",
        operation: "solve",
        variable: "x",
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        expressions: ["x = 2", "y = 1"],
        lower: "0",
        operation: "solve",
        variable: "x",
        variables: ["x"],
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
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
      Schema.decodeUnknownSync(MathToolInputSchema)({
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
      Schema.decodeUnknownSync(MathToolInputSchema)({
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

  it("accepts matrix eigen analysis tool input", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
        matrix: [
          ["2", "1"],
          ["0", "2"],
        ],
        operation: "eigen_analysis",
      })
    ).toEqual({
      matrix: [
        ["2", "1"],
        ["0", "2"],
      ],
      operation: "eigen_analysis",
    });
  });

  it("requires calculus variables for expressions with parameters", () => {
    const decodeMathToolInput = Schema.decodeUnknownSync(MathToolInputSchema);

    expect(
      decodeMathToolInput({
        expression: "sin(x) + exp(-x)",
        operation: "integrate",
      })
    ).toEqual({
      expression: "sin(x) + exp(-x)",
      operation: "integrate",
    });

    expect(() =>
      decodeMathToolInput({
        expression: "x^(a-1) * exp(-x)",
        lower: "0",
        operation: "integrate",
        upper: "oo",
      })
    ).toThrow();

    expect(
      decodeMathToolInput({
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

    expect(
      decodeMathToolInput({
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
      decodeMathToolInput({
        expression: "x^x",
        operation: "differentiate",
        order: 0,
        variable: "x",
      })
    ).toThrow();
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

  it("decodes probability summary input with required distribution parameters", () => {
    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
        distribution: "poisson",
        operation: "distribution",
        parameters: {
          lambda: "3",
        },
        variable: "X",
      })
    ).toEqual({
      distribution: "poisson",
      operation: "distribution",
      parameters: {
        lambda: "3",
      },
      variable: "X",
    });

    expect(
      Schema.decodeUnknownSync(MathToolInputSchema)({
        distribution: "poisson",
        expression: "X^2",
        operation: "expected_value",
        parameters: {
          lambda: "3",
        },
        variable: "X",
      })
    ).toEqual({
      distribution: "poisson",
      expression: "X^2",
      operation: "expected_value",
      parameters: {
        lambda: "3",
      },
      variable: "X",
    });
  });

  it("requires canonical normal standard_deviation input", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        distribution: "normal",
        operation: "expected_value",
        parameters: {
          mean: "70",
          standardDeviation: "10",
        },
      })
    ).toThrow();
  });

  it("decodes exact, cumulative, tail, and interval probability events", () => {
    const decodeMathToolInput = Schema.decodeUnknownSync(MathToolInputSchema);

    expect(
      decodeMathToolInput({
        distribution: "binomial",
        operation: "point_probability",
        parameters: {
          n: "10",
          p: "0.4",
        },
        point: "3",
      })
    ).toEqual({
      distribution: "binomial",
      operation: "point_probability",
      parameters: {
        n: "10",
        p: "0.4",
      },
      point: "3",
    });

    expect(
      decodeMathToolInput({
        distribution: "normal",
        inclusive: false,
        operation: "cumulative_probability",
        parameters: {
          mean: "70",
          standard_deviation: "10",
        },
        upper: "85",
      })
    ).toEqual({
      distribution: "normal",
      inclusive: false,
      operation: "cumulative_probability",
      parameters: {
        mean: "70",
        standard_deviation: "10",
      },
      upper: "85",
    });

    expect(
      decodeMathToolInput({
        distribution: "poisson",
        inclusive: false,
        lower: "4",
        operation: "tail_probability",
        parameters: {
          lambda: "3",
        },
      })
    ).toEqual({
      distribution: "poisson",
      inclusive: false,
      lower: "4",
      operation: "tail_probability",
      parameters: {
        lambda: "3",
      },
    });

    expect(
      decodeMathToolInput({
        distribution: "uniform",
        lower: "2",
        lowerInclusive: false,
        operation: "interval_probability",
        parameters: {
          lower: "0",
          upper: "10",
        },
        upper: "8",
        upperInclusive: true,
      })
    ).toEqual({
      distribution: "uniform",
      lower: "2",
      lowerInclusive: false,
      operation: "interval_probability",
      parameters: {
        lower: "0",
        upper: "10",
      },
      upper: "8",
      upperInclusive: true,
    });
  });

  it("rejects probability events without required event bounds", () => {
    const decodeMathToolInput = Schema.decodeUnknownSync(MathToolInputSchema);

    expect(() =>
      decodeMathToolInput({
        distribution: "normal",
        operation: "interval_probability",
        parameters: {
          mean: "70",
          standard_deviation: "10",
        },
        upper: "85",
      })
    ).toThrow();

    expect(() =>
      decodeMathToolInput({
        distribution: "poisson",
        operation: "tail_probability",
        parameters: {
          lambda: "3",
        },
      })
    ).toThrow();
  });

  it("rejects probability inputs without required distribution parameters", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        distribution: "normal",
        operation: "distribution",
        parameters: {
          mean: "70",
        },
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        distribution: "normal",
        operation: "cumulative_probability",
        parameters: {
          mean: "70",
        },
        upper: "85",
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        distribution: "binomial",
        operation: "point_probability",
        parameters: {
          n: "10",
        },
        point: "3",
      })
    ).toThrow();
  });
});
