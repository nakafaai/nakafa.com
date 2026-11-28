// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  LENS,
  lensOf,
} from "@repo/design-system/components/three/apparatus/lens";

describe("the camera of a close view", () => {
  const lens = lensOf([0.1, 0.6, 0.05], 0.03);
  const distance = lens.camera[2] - 0.05;

  it("stands straight in front of the point it looks at", () => {
    expect(lens.camera[0]).toBe(0.1);
    expect(lens.camera[1]).toBe(0.6);
    expect(distance).toBeGreaterThan(0);
  });

  it("sees exactly the span asked for, top to bottom", () => {
    const seen = 2 * distance * Math.tan(((LENS.fov / 2) * Math.PI) / 180);
    expect(seen).toBeCloseTo(0.03, 9);
  });

  it("keeps the subject between its near and far planes", () => {
    expect(lens.near).toBeLessThan(distance);
    expect(lens.far).toBeGreaterThan(distance);
  });
});
