import { describe, expect, it } from "@effect/vitest";
import { formatTrigRatioMath } from "@repo/design-system/components/contents/mathematics/trig";

const formatApproximation = (value: number) => value.toFixed(2);

describe("trigonometric ratio math", () => {
  it("writes an exact value as the fraction the unit circle shows", () => {
    expect(formatTrigRatioMath(Math.SQRT1_2, formatApproximation)).toBe(
      "= \\frac{\\sqrt{2}}{2}"
    );
    expect(formatTrigRatioMath(-0.5, formatApproximation)).toBe(
      "= -\\frac{1}{2}"
    );
  });

  it("writes zero and one as their own values", () => {
    expect(formatTrigRatioMath(0, formatApproximation)).toBe("= 0");
    expect(formatTrigRatioMath(1, formatApproximation)).toBe("= 1");
  });

  it("approximates a value that has no common exact form", () => {
    expect(formatTrigRatioMath(0.3, formatApproximation)).toBe("\\approx 0.30");
  });

  it("keeps a comma decimal inside the math, so it keeps a decimal point's spacing", () => {
    expect(formatTrigRatioMath(0.3, () => "0,30")).toBe("\\approx 0{,}30");
  });

  it("keeps the exact value that the caller gives", () => {
    expect(formatTrigRatioMath(0.3, formatApproximation, "\\frac{3}{10}")).toBe(
      "= \\frac{3}{10}"
    );
  });
});
