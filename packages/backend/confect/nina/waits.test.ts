import { describe, expect, it } from "@effect/vitest";
import { percentile } from "@repo/backend/confect/nina/waits";
import { Array as Arr } from "effect";

/** Ten different values out of order, so a rank only means something after a sort. */
const TEN = [40, 10, 90, 20, 70, 30, 100, 60, 50, 80] as const;

describe("nearest-rank percentile", () => {
  it("takes the value at rank ceil(percent / 100 * count) of the sorted values", () => {
    expect(percentile(TEN, 50)).toBe(50);
    expect(percentile(TEN, 90)).toBe(90);
    // 91 percent of ten values is rank 9.1, which rounds up to the tenth.
    expect(percentile(TEN, 91)).toBe(100);
    // 21 percent is rank 2.1, which rounds up to the third and not down to the second.
    expect(percentile(TEN, 21)).toBe(30);
  });

  it("gives a value that occurred, the lower of the two in the middle for an even count", () => {
    // Interpolating between 10 and 20 would give 15, which no one waited.
    expect(percentile([20, 10], 50)).toBe(10);
    expect(percentile([4, 1, 3, 2], 50)).toBe(2);
    expect(percentile([30, 10, 20], 50)).toBe(20);
  });

  it("gives the smallest value at 0 and the largest at 100", () => {
    expect(percentile(TEN, 0)).toBe(10);
    expect(percentile(TEN, 100)).toBe(100);
  });

  it("gives the only value of a single value at any percent", () => {
    expect(
      Arr.map([0, 50, 90, 100], (percent) => percentile([7], percent))
    ).toEqual([7, 7, 7, 7]);
  });

  it("multiplies before it divides, so rounding error never lifts a rank", () => {
    // 14 / 100 * 50 is 7.000000000000001 in floating point, and its ceiling is 8.
    expect(percentile(Arr.range(1, 50), 14)).toBe(7);
    // 28 / 100 * 25 is 7.000000000000001 too.
    expect(percentile(Arr.range(1, 25), 28)).toBe(7);
  });

  it("keeps repeated values and leaves its input as it was", () => {
    const values = [3, 1, 3, 2] as const;
    expect(percentile(values, 75)).toBe(3);
    expect(percentile(values, 50)).toBe(2);
    expect(values).toEqual([3, 1, 3, 2]);
  });
});
