// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { hashOf, seedOf, smoothOf, unitOf } from "@/lib/island/noise";

describe("island/noise", () => {
  it("answers the same value for the same seed and cell, and another for another cell", () => {
    expect(hashOf(7, 1, 2, 3)).toBe(hashOf(7, 1, 2, 3));
    expect(hashOf(7, 1, 2, 3)).not.toBe(hashOf(7, 1, 2, 4));
    expect(hashOf(7, 1)).toBe(hashOf(7, 1, 0, 0));
  });

  it("keeps unit values in [0, 1)", () => {
    for (let x = 0; x < 200; x += 1) {
      const value = unitOf(3, x, x * 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("blends value noise gently between its corners", () => {
    const corner = smoothOf(9, 0, 0, 5);
    expect(corner).toBeCloseTo(unitOf(9, 0, 0, 0), 10);
    expect(
      Math.abs(smoothOf(9, 2, 2, 5) - smoothOf(9, 2.1, 2, 5))
    ).toBeLessThan(0.05);
  });

  it("seeds an island from the text that names it", () => {
    expect(seedOf("users:1")).toBe(seedOf("users:1"));
    expect(seedOf("users:1")).not.toBe(seedOf("users:2"));
    expect(seedOf("")).toBe(7);
  });
});
