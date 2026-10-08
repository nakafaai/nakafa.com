import { describe, expect, it } from "@effect/vitest";
import {
  fitRegressionLine,
  predictY,
} from "@repo/design-system/lib/charts/regression";
import { Option } from "effect";

describe("fitting a regression line", () => {
  it("recovers the line that passes through every point", () => {
    const line = fitRegressionLine([
      { x: 3, y: 7 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ]);

    expect(line).toEqual(Option.some({ b: 1, m: 2, xMax: 3, xMin: 1 }));
  });

  it("balances the residuals of points that scatter around a line", () => {
    // The mean of x is 2.5 and of y is 4.5, which the line must pass through.
    const line = fitRegressionLine([
      { x: 1, y: 2 },
      { x: 2, y: 5 },
      { x: 3, y: 4 },
      { x: 4, y: 7 },
    ]);

    expect(Option.map(line, ({ b, m }) => [m, b])).toEqual(
      Option.some([1.4, 1])
    );
    expect(Option.map(line, (fit) => predictY(fit, 2.5))).toEqual(
      Option.some(4.5)
    );
  });

  it("leaves the line undefined for fewer than two points", () => {
    expect(fitRegressionLine([])).toEqual(Option.none());
    expect(fitRegressionLine([{ x: 1, y: 1 }])).toEqual(Option.none());
  });

  it("leaves the line undefined when every point shares one x", () => {
    const line = fitRegressionLine([
      { x: 2, y: 1 },
      { x: 2, y: 5 },
    ]);

    expect(line).toEqual(Option.none());
  });
});

describe("reading a regression line", () => {
  it("predicts y from its slope and intercept", () => {
    expect(predictY({ b: 1, m: 2, xMax: 3, xMin: 1 }, 10)).toBe(21);
  });
});
