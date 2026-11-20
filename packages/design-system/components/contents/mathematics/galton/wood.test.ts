// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { woodGrain } from "@repo/design-system/components/contents/mathematics/galton/wood";

describe("wood grain", () => {
  it("shades every texel between the dark late wood and the pale early wood, the same on every call", () => {
    const field = woodGrain(64, 32);
    expect(field).toHaveLength(64 * 32);
    expect(Math.min(...field)).toBeGreaterThanOrEqual(0.68 - 1e-6);
    expect(Math.max(...field)).toBeLessThanOrEqual(1);
    expect(woodGrain(64, 32)).toEqual(field);
  });

  it("varies across the lines more than along them", () => {
    const field = woodGrain(64, 64);
    const along = Math.abs(
      Number(field[10 * 64 + 5]) - Number(field[10 * 64 + 6])
    );
    const spread = Math.max(...field) - Math.min(...field);
    expect(spread).toBeGreaterThan(0.2);
    expect(along).toBeLessThan(spread / 2);
  });
});
