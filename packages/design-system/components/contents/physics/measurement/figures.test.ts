import { describe, expect, it } from "@effect/vitest";
import {
  readingFigures,
  resolve,
  scientific,
} from "@repo/design-system/components/contents/physics/measurement/figures";

describe("significant figures", () => {
  it("writes a small value with its coefficient and a negative exponent", () => {
    expect(scientific(0.000_764, 3)).toEqual({
      coefficient: 7.64,
      exponent: -4,
    });
    expect(scientific(0.000_068, 2)).toEqual({
      coefficient: 6.8,
      exponent: -5,
    });
  });

  it("moves one power over when the coefficient rounds up to ten", () => {
    expect(scientific(9.996e-5, 3)).toEqual({ coefficient: 1, exponent: -4 });
  });

  it("counts the digits a reading supports from its first digit to its resolution", () => {
    expect(readingFigures(31, 1)).toBe(2);
    expect(readingFigures(31, 0.1)).toBe(3);
    expect(readingFigures(31, 0.01)).toBe(4);
    expect(readingFigures(0.0026, 0.0001)).toBe(2);
    expect(readingFigures(104, 1)).toBe(3);
  });

  it("rounds a value to the step its instrument resolves", () => {
    expect(resolve(31.004, 0.1)).toBe(31);
    expect(resolve(31.004, 0.01)).toBe(31);
    expect(resolve(8.2352, 0.005)).toBeCloseTo(8.235, 12);
    expect(resolve(52.4, 1)).toBe(52);
    expect(resolve(16.04, 2)).toBe(16);
  });
});
