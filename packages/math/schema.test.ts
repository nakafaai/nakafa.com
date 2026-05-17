import { MathDataSchema } from "@repo/math/schema/data";
import { MathRequestSchema } from "@repo/math/schema/request";
import { MathResultSchema } from "@repo/math/schema/result";
import { MathToolInputSchema } from "@repo/math/schema/tool-input";
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
        operation: "expected_value",
        parameters: {
          lambda: "3",
        },
      })
    ).toEqual({
      distribution: "poisson",
      operation: "expected_value",
      parameters: {
        lambda: "3",
      },
    });
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
