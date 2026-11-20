// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cropHills,
  hillMatrix,
  rootedHills,
  SPACING,
} from "@repo/design-system/components/contents/biology/paddy/field";
import { XRAY } from "@repo/design-system/components/contents/biology/paddy/xray";
import { Array as Arr } from "effect";
import { Vector3 } from "three";

describe("the paddy field's layout", () => {
  it("draws only the plants over the X-ray zone with roots, in full detail", () => {
    const rice = rootedHills("rice");

    expect(rice.length).toBeGreaterThan(20);
    expect(
      Arr.every(
        rice,
        (hill) =>
          hill.detail === "near" &&
          Math.hypot(hill.x - XRAY.zone[0], hill.z - XRAY.zone[1]) < 0.62
      )
    ).toBe(true);
    expect(rootedHills("dryland").length).toBeLessThan(rice.length);
  });

  it("runs the crop back to the haze, plainer with distance, wider each row", () => {
    const hills = cropHills("rice");
    const nearest = Arr.filter(hills, (hill) => hill.z > 0.2);
    const farthest = Arr.filter(hills, (hill) => hill.z < -11.8);

    expect(Arr.some(hills, (hill) => hill.detail === "far")).toBe(true);
    expect(Arr.every(farthest, (hill) => hill.detail === "distant")).toBe(true);
    expect(farthest.length).toBeGreaterThan(nearest.length * 5);
    expect(SPACING.rice.across).toBe(0.2);
  });

  it("stands a plant's roots at its hill, turned as the plant is", () => {
    const hill = {
      detail: "near",
      height: 1,
      rooted: true,
      x: 0.4,
      yaw: Math.PI / 2,
      z: -0.2,
    } as const;
    const tip = new Vector3(0.1, -0.05, 0).applyMatrix4(hillMatrix(hill));

    expect(tip.x).toBeCloseTo(0.4, 6);
    expect(tip.y).toBeCloseTo(-0.05, 6);
    expect(tip.z).toBeCloseTo(-0.3, 6);
  });
});
