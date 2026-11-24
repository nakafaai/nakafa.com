// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { jointAnglesAt } from "@repo/design-system/components/contents/biology/joint/model";

describe("joint movement lab model", () => {
  it("restricts sutures to zero motion, discs to slight flex, hinges to one plane, and ball-and-socket to 3D", () => {
    expect(jointAnglesAt("suture", 0.8)).toEqual({
      pitchRad: 0,
      rollRad: 0,
      yawRad: 0,
    });

    const disc = jointAnglesAt("disc", 1);
    expect(disc.pitchRad).toBeCloseTo(0.2);
    expect(disc.yawRad).toBe(0);

    const hinge = jointAnglesAt("hinge", 1);
    expect(hinge.rollRad).toBeGreaterThan(2);
    expect(hinge.pitchRad).toBe(0);
    expect(hinge.yawRad).toBe(0);

    const shoulder = jointAnglesAt("ballSocket", 0.25);
    expect(Math.abs(shoulder.pitchRad)).toBeGreaterThan(0.5);
    expect(Math.abs(shoulder.yawRad)).toBeGreaterThan(0.3);
  });
});
