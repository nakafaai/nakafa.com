// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { swirlShares } from "@repo/design-system/components/contents/mathematics/marble/swirl";

describe("a marble's swirl", () => {
  it("keeps every share of white glass between none and all, the same on every call", () => {
    const field = swirlShares(64, 32);
    expect(field).toHaveLength(64 * 32);
    expect(Math.min(...field)).toBe(0);
    expect(Math.max(...field)).toBeLessThanOrEqual(1);
    expect(Math.max(...field)).toBeGreaterThan(0.9);
    expect(swirlShares(64, 32)).toEqual(field);
  });

  it("leaves most of the marble its own colour, with a few ribbons through it", () => {
    const field = swirlShares(128, 64);
    const white = field.filter((share) => share > 0.5).length / field.length;
    expect(white).toBeGreaterThan(0.05);
    expect(white).toBeLessThan(0.4);
  });
});
