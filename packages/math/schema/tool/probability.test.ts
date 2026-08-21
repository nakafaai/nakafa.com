import { MathProbabilityInputSchema } from "@repo/math/schema/tool/probability";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathProbabilityInputSchema", () => {
  const decodeProbabilityInput = Schema.decodeUnknownSync(
    MathProbabilityInputSchema
  );

  it("decodes distribution summaries and moments", () => {
    const inputs = [
      {
        distribution: "poisson",
        operation: "distribution",
        parameters: { lambda: "3" },
        variable: "X",
      },
      {
        distribution: "poisson",
        expression: "X^2",
        operation: "expected_value",
        parameters: { lambda: "3" },
        variable: "X",
      },
      {
        distribution: "poisson",
        operation: "expected_value",
        parameters: { lambda: "3" },
        variable: "X",
      },
      {
        distribution: "poisson",
        expression: "X^2",
        operation: "expected_value",
        parameters: { lambda: "3" },
      },
    ];

    for (const input of inputs) {
      expect(decodeProbabilityInput(input)).toEqual(input);
    }
  });

  it("rejects moment expressions with inconsistent random variables", () => {
    expect(() =>
      decodeProbabilityInput({
        distribution: "normal",
        expression: "X + Y",
        operation: "expected_value",
        parameters: {
          mean: "0",
          standard_deviation: "1",
        },
        variable: "X",
      })
    ).toThrow();

    expect(() =>
      decodeProbabilityInput({
        distribution: "normal",
        expression: "X + Y",
        operation: "variance_probability",
        parameters: {
          mean: "0",
          standard_deviation: "1",
        },
        variable: "X",
      })
    ).toThrow();

    expect(() =>
      decodeProbabilityInput({
        distribution: "normal",
        expression: "X^2",
        operation: "expected_value",
        parameters: {
          mean: "0",
          standard_deviation: "1",
        },
        variable: "Y",
      })
    ).toThrow();
  });

  it("requires canonical normal standard_deviation input", () => {
    expect(() =>
      decodeProbabilityInput({
        distribution: "normal",
        operation: "expected_value",
        parameters: {
          mean: "70",
          standardDeviation: "10",
        },
      })
    ).toThrow();
  });

  it("decodes exact, cumulative, tail, and interval events", () => {
    const inputs = [
      {
        distribution: "binomial",
        operation: "point_probability",
        parameters: {
          n: "10",
          p: "0.4",
        },
        point: "3",
      },
      {
        distribution: "normal",
        inclusive: false,
        operation: "cumulative_probability",
        parameters: {
          mean: "70",
          standard_deviation: "10",
        },
        upper: "85",
      },
      {
        distribution: "poisson",
        inclusive: false,
        lower: "4",
        operation: "tail_probability",
        parameters: { lambda: "3" },
      },
      {
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
      },
    ];

    for (const input of inputs) {
      expect(decodeProbabilityInput(input)).toEqual(input);
    }
  });

  it("rejects events without required bounds", () => {
    expect(() =>
      decodeProbabilityInput({
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
      decodeProbabilityInput({
        distribution: "poisson",
        operation: "tail_probability",
        parameters: { lambda: "3" },
      })
    ).toThrow();
  });

  it("rejects inputs without required distribution parameters", () => {
    expect(() =>
      decodeProbabilityInput({
        distribution: "normal",
        operation: "distribution",
        parameters: { mean: "70" },
      })
    ).toThrow();

    expect(() =>
      decodeProbabilityInput({
        distribution: "normal",
        operation: "cumulative_probability",
        parameters: { mean: "70" },
        upper: "85",
      })
    ).toThrow();

    expect(() =>
      decodeProbabilityInput({
        distribution: "binomial",
        operation: "point_probability",
        parameters: { n: "10" },
        point: "3",
      })
    ).toThrow();
  });
});
