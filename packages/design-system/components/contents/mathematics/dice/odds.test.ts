// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  outcomes,
  probabilityMath,
  probabilityOf,
  resultCount,
  waysTo,
} from "@repo/design-system/components/contents/mathematics/dice/odds";
import { Array as Arr } from "effect";

describe("dice odds", () => {
  it("lists the faces of one die and the sums of two", () => {
    expect(outcomes(1)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(outcomes(2)).toEqual(Arr.range(2, 12));
    expect(resultCount(1)).toBe(6);
    expect(resultCount(2)).toBe(36);
  });

  it("counts the ordered pairs that make each sum", () => {
    expect(Arr.map(outcomes(2), (sum) => waysTo(2, sum))).toEqual([
      1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1,
    ]);
    expect(waysTo(1, 6)).toBe(1);
    expect(waysTo(2, 1)).toBe(0);
  });

  it("gives probabilities that add up to one", () => {
    const total = Arr.reduce(
      outcomes(2),
      0,
      (sum, outcome) => sum + probabilityOf(2, outcome)
    );
    expect(total).toBeCloseTo(1, 12);
    expect(probabilityOf(1, 3)).toBeCloseTo(1 / 6, 12);
  });

  it("writes a probability as a fraction, in lowest terms when it reduces", () => {
    expect(probabilityMath(1, 6)).toBe("\\frac{1}{6}");
    expect(probabilityMath(2, 2)).toBe("\\frac{1}{36}");
    expect(probabilityMath(2, 7)).toBe("\\frac{6}{36} = \\frac{1}{6}");
    expect(probabilityMath(2, 13)).toBe("\\frac{0}{36} = 0");
  });
});
