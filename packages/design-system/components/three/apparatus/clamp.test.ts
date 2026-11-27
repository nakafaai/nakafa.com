// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { armOf } from "@repo/design-system/components/three/apparatus/clamp";

describe("the arm of a clamp", () => {
  it("is as long as the rod and the grip are apart across the bench, whatever the grip's height", () => {
    expect(armOf([-0.11, -0.04], [0, 0.62, 0.05]).reach).toBeCloseTo(
      Math.hypot(0.11, 0.09)
    );
  });

  it("needs no turn for a grip straight along the stand's own axis", () => {
    expect(armOf([0, 0], [0.2, 0.3, 0]).turn).toBeCloseTo(0);
  });

  it("turns toward the viewer for a grip in front of the rod, and away for one behind", () => {
    expect(armOf([0, 0], [0, 0.3, 0.2]).turn).toBeCloseTo(-Math.PI / 2);
    expect(armOf([0, 0], [0, 0.3, -0.2]).turn).toBeCloseTo(Math.PI / 2);
  });
});
