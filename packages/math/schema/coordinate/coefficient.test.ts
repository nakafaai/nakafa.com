import {
  addPlaneCoefficient,
  isPlaneCoefficientMatch,
} from "@repo/math/schema/coordinate/coefficient";
import { describe, expect, it } from "vitest";

describe("coordinate plane coefficient arithmetic", () => {
  it("rejects nonfinite coefficient sums", () => {
    expect(
      addPlaneCoefficient(Number.MAX_VALUE, Number.MAX_VALUE)
    ).toBeUndefined();
  });

  it("rejects missing or nonfinite scaled coefficients", () => {
    expect(isPlaneCoefficientMatch(1, 1, undefined)).toBe(false);
    expect(isPlaneCoefficientMatch(1, 1, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
