import { describe, expect, it } from "@effect/vitest";

import { clamp } from "@repo/design-system/components/contents/physics/kinematics/clamp";

describe("clamp", () => {
  it("returns the minimum below the range, the value inside it, and the maximum above it", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it("keeps NaN as NaN instead of moving it to the minimum", () => {
    expect(clamp(Number.NaN, 0, 1)).toBeNaN();
  });
});
