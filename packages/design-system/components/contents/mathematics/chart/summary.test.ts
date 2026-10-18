// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  summarizeSeries,
  totalOf,
} from "@repo/design-system/components/contents/mathematics/chart/summary";
import { Option } from "effect";

describe("chart totals", () => {
  it("adds up the values of a series, and no values add up to zero", () => {
    expect(totalOf([1.5, 2, -0.5])).toBe(3);
    expect(totalOf([])).toBe(0);
  });
});

describe("chart series readings", () => {
  it("finds the highest and the lowest category, with the total and the mean", () => {
    expect(summarizeSeries(["Jan", "Feb", "Mar"], [27, 31.5, 26.5])).toEqual(
      Option.some({
        highest: { category: "Feb", value: 31.5 },
        lowest: { category: "Mar", value: 26.5 },
        mean: 85 / 3,
        total: 85,
      })
    );
  });

  it("reads a series of negative values", () => {
    expect(summarizeSeries(["a", "b"], [-4, -1])).toEqual(
      Option.some({
        highest: { category: "b", value: -1 },
        lowest: { category: "a", value: -4 },
        mean: -2.5,
        total: -5,
      })
    );
  });

  it("has no reading without categories", () => {
    expect(summarizeSeries([], [])).toEqual(Option.none());
    expect(summarizeSeries([], [1])).toEqual(Option.none());
  });
});
