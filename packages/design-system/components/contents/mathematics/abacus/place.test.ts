// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  carryChain,
  clampValue,
  digitsOf,
  expandedForm,
  largestValue,
  nextValue,
  numeral,
  placePower,
} from "@repo/design-system/components/contents/mathematics/abacus/place";

describe("place value on four spikes", () => {
  it("holds up to b^4 - 1, and keeps a value whole and inside that range", () => {
    expect(largestValue(2)).toBe(15);
    expect(largestValue(10)).toBe(9999);
    expect(clampValue(20, 2)).toBe(15);
    expect(clampValue(-3, 5)).toBe(0);
    expect(clampValue(6.6, 8)).toBe(7);
  });

  it("follows the largest number with 0, and every other one with one more", () => {
    expect(nextValue(14, 2)).toBe(15);
    expect(nextValue(15, 2)).toBe(0);
    expect(nextValue(624, 5)).toBe(0);
  });

  it("splits a number into its digits, units first", () => {
    expect(digitsOf(11, 2)).toEqual([1, 1, 0, 1]);
    expect(digitsOf(123, 5)).toEqual([3, 4, 4, 0]);
    expect(digitsOf(2026, 10)).toEqual([6, 2, 0, 2]);
    expect(digitsOf(0, 8)).toEqual([0, 0, 0, 0]);
  });

  it("counts how many full spikes adding one carries from", () => {
    expect(carryChain(6, 2)).toBe(0);
    expect(carryChain(7, 2)).toBe(3);
    expect(carryChain(99, 10)).toBe(2);
    expect(carryChain(9999, 10)).toBe(4);
  });

  it("writes the numeral with its base as a subscript and no leading zeros", () => {
    expect(numeral(11, 2)).toBe("1011_{2}");
    expect(numeral(123, 5)).toBe("443_{5}");
    expect(numeral(7, 8)).toBe("7_{8}");
    expect(numeral(0, 10)).toBe("0_{10}");
  });

  it("expands a number from its leading digit, keeping the zeros between", () => {
    expect(expandedForm(11, 2)).toBe(
      "1 \\times 2^{3} + 0 \\times 2^{2} + 1 \\times 2 + 1"
    );
    expect(expandedForm(13, 5)).toBe("2 \\times 5 + 3");
    expect(expandedForm(4, 10)).toBe("4");
    expect(expandedForm(0, 2)).toBe("0");
  });

  it("names each place as a power of the base", () => {
    expect(placePower(3, 2)).toBe("2^{3}");
    expect(placePower(0, 10)).toBe("10^{0}");
  });
});
