import { describe, expect, it } from "@effect/vitest";

import { lerp } from "@repo/design-system/components/contents/physics/kinematics/lerp";

describe("lerp", () => {
  it("returns the start at progress zero and the end at progress one", () => {
    expect(lerp(2, 10, 0)).toBe(2);
    expect(lerp(2, 10, 1)).toBe(10);
  });

  it("interpolates between the endpoints, also when descending", () => {
    expect(lerp(2, 10, 0.25)).toBe(4);
    expect(lerp(10, 2, 0.5)).toBe(6);
  });

  it("extends the line past the endpoints for progress outside zero to one", () => {
    expect(lerp(2, 10, 2)).toBe(18);
    expect(lerp(2, 10, -1)).toBe(-6);
  });
});
