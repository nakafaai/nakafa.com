// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  grainField,
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";

describe("procedural grain", () => {
  it("hashes the same cell to the same unit value", () => {
    expect(hashUnit(3, 7)).toBe(hashUnit(3, 7));
    expect(hashUnit(3, 7)).not.toBe(hashUnit(7, 3));
    expect(hashUnit(-5, 12)).toBeGreaterThanOrEqual(0);
    expect(hashUnit(-5, 12)).toBeLessThan(1);
  });

  it("tiles its noise every period cells", () => {
    expect(valueNoise(1.25, 2.5, 8)).toBeCloseTo(valueNoise(9.25, 10.5, 8), 12);
    expect(valueNoise(2, 3, 8)).toBe(hashUnit(2, 3));
  });

  it("fills a square field with values in [0, 1)", () => {
    const field = grainField(64);
    expect(field).toHaveLength(64 * 64);
    expect(Math.min(...field)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...field)).toBeLessThan(1);
  });
});
