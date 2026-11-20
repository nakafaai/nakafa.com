// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  binomialMean,
  binomialMode,
  binomialProbability,
  binomialSpread,
  choose,
  expectedCounts,
} from "@repo/design-system/components/contents/mathematics/galton/binomial";
import { Array as Arr } from "effect";

describe("the binomial distribution of a Galton board", () => {
  it("counts the ways to choose k of n, and none outside 0 to n", () => {
    expect(choose(8, 4)).toBe(70);
    expect(choose(12, 6)).toBe(924);
    expect(choose(5, 0)).toBe(1);
    expect(choose(5, 5)).toBe(1);
    expect(choose(5, 2)).toBe(choose(5, 3));
    expect(choose(4, -1)).toBe(0);
    expect(choose(4, 5)).toBe(0);
  });

  it("gives each bin its binomial probability, summing to one", () => {
    expect(binomialProbability(8, 0.5, 4)).toBeCloseTo(70 / 256, 12);
    expect(binomialProbability(4, 0.7, 3)).toBeCloseTo(4 * 0.343 * 0.3, 12);
    const total = Arr.reduce(expectedCounts(10, 0.3, 1), 0, (a, b) => a + b);
    expect(total).toBeCloseTo(1, 12);
  });

  it("expects balls times the probability in every bin", () => {
    const counts = expectedCounts(4, 0.5, 160);
    expect(counts).toHaveLength(5);
    expect(counts[2]).toBeCloseTo(60, 9);
    expect(counts[0]).toBeCloseTo(10, 9);
  });

  it("gives the mean np and the spread of the square root of np(1 - p)", () => {
    expect(binomialMean(8, 0.5)).toBe(4);
    expect(binomialSpread(8, 0.5)).toBeCloseTo(Math.sqrt(2), 12);
    expect(binomialSpread(12, 0.3)).toBeCloseTo(Math.sqrt(2.52), 12);
  });

  it("finds the most likely bin", () => {
    expect(binomialMode(8, 0.5)).toBe(4);
    expect(binomialMode(4, 0.7)).toBe(3);
    expect(binomialMode(4, 0.3)).toBe(1);
    expect(binomialMode(5, 0.5)).toBe(3);
    expect(binomialProbability(5, 0.5, 3)).toBeCloseTo(
      binomialProbability(5, 0.5, 2),
      12
    );
    for (const rows of Arr.range(4, 12)) {
      for (const p of [0.3, 0.5, 0.7]) {
        const mode = binomialMode(rows, p);
        const best = Arr.reduce(expectedCounts(rows, p, 1), 0, (a, b) =>
          Math.max(a, b)
        );
        expect(binomialProbability(rows, p, mode)).toBeCloseTo(best, 12);
      }
    }
  });
});
