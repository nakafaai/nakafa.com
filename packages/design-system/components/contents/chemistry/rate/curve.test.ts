import { describe, expect, it } from "@effect/vitest";
import {
  amountAt,
  TIME_SPAN,
} from "@repo/design-system/components/contents/chemistry/rate/curve";

describe("gas curve", () => {
  it("starts at nothing and levels off at the final amount", () => {
    expect(amountAt(0.05, "powder", 0)).toBe(0);
    expect(amountAt(0.05, "powder", TIME_SPAN)).toBeCloseTo(0.05, 4);
    expect(amountAt(0.025, "chips", 40)).toBeCloseTo(0.025, 12);
  });

  it("rises faster the finer the solid, for the same final amount", () => {
    // SPM Kimia set 1, question 17: powder against chips.
    expect(amountAt(0.05, "powder", 0.1)).toBeGreaterThan(
      amountAt(0.05, "granules", 0.1)
    );
    expect(amountAt(0.05, "granules", 0.1)).toBeGreaterThan(
      amountAt(0.05, "chips", 0.1)
    );
    expect(amountAt(0.05, "powder", 0.5)).toBeGreaterThan(
      amountAt(0.05, "chips", 0.5)
    );
  });
});
