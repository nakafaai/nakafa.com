// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BUNDLE_PLACES,
  clampCount,
  divisionLadder,
  FEWEST_STICKS,
  ladderMath,
  largestCount,
  MOST_STICKS,
  numeralLength,
  numeralMath,
  placeDigits,
  placeValueMath,
  stepMath,
} from "@repo/design-system/components/contents/mathematics/bundle/digits";
import { Array as Arr } from "effect";

describe("bundle digits", () => {
  it("holds as many sticks as the desk fits, and never more than one tray", () => {
    expect(largestCount(2)).toBe(15);
    expect(largestCount(3)).toBe(53);
    expect(largestCount(4)).toBe(127);
    expect(largestCount(5)).toBe(249);
    expect(largestCount(6)).toBe(MOST_STICKS);
    expect(largestCount(9)).toBe(MOST_STICKS);
  });

  it("clamps a count to a whole number of sticks the base can show", () => {
    expect(clampCount(0, 5)).toBe(FEWEST_STICKS);
    expect(clampCount(12.4, 5)).toBe(12);
    expect(clampCount(237, 2)).toBe(15);
    expect(clampCount(999, 8)).toBe(MOST_STICKS);
  });

  it("divides again and again until the quotient is zero", () => {
    expect(divisionLadder(237, 5)).toEqual([
      { dividend: 237, quotient: 47, remainder: 2 },
      { dividend: 47, quotient: 9, remainder: 2 },
      { dividend: 9, quotient: 1, remainder: 4 },
      { dividend: 1, quotient: 0, remainder: 1 },
    ]);
    expect(divisionLadder(0, 5)).toEqual([]);
  });

  it("reads the remainders as the digits, last first", () => {
    expect(placeDigits(237, 5)).toEqual([2, 2, 4, 1]);
    expect(placeDigits(7, 8)).toEqual([7, 0, 0, 0]);
    expect(numeralLength(237, 5)).toBe(BUNDLE_PLACES);
    expect(numeralLength(7, 8)).toBe(1);
    expect(numeralLength(0, 8)).toBe(1);
    expect(numeralMath(237, 5)).toBe("1422_{5}");
    expect(numeralMath(64, 8)).toBe("100_{8}");
  });

  it("agrees with the base's own reading of every count the desk shows", () => {
    for (const base of Arr.range(2, 9)) {
      for (const count of Arr.range(FEWEST_STICKS, largestCount(base))) {
        expect(numeralMath(count, base)).toBe(
          `${count.toString(base)}_{${base}}`
        );
      }
    }
  });

  it("writes each division, the ladder and the place values as KaTeX", () => {
    expect(stepMath({ dividend: 47, quotient: 9, remainder: 2 }, 5)).toBe(
      "47 = 9 \\times 5 + 2"
    );
    expect(ladderMath(9, 5)).toBe(
      "\\begin{aligned} 9 &= 1 \\times 5 + 4 \\\\ 1 &= 0 \\times 5 + 1 \\end{aligned}"
    );
    expect(placeValueMath(0, 5, true)).toBe("5^{0} \\, = 1");
    expect(placeValueMath(3, 5, true)).toBe("5^{3} \\, = 125");
    expect(placeValueMath(3, 5, false)).toBe("5^{3}");
  });
});
