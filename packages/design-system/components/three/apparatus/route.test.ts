// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  FITTING,
  routeOf,
} from "@repo/design-system/components/three/apparatus/route";

describe("the route of a test lead", () => {
  const route = routeOf({
    ends: ["clip", "plug"],
    from: [-0.2, 0.14, 0.06],
    lift: 0.04,
    to: [0, 0.05, -0.1],
  });

  it("leaves the top of each fitting, not the place the fitting grips", () => {
    expect(route[0]).toEqual([-0.2, 0.14 + FITTING.clip, 0.06]);
    expect(route[4]).toEqual([0, 0.05 + FITTING.plug, -0.1]);
  });

  it("runs up out of each fitting before it bends toward the other", () => {
    expect(route[1][1]).toBeGreaterThan(route[0][1]);
    expect(route[3][1]).toBeGreaterThan(route[4][1]);
    expect(route[1][0]).toBeGreaterThan(route[0][0]);
    expect(route[3][0]).toBeLessThan(route[4][0]);
  });

  it("lifts its middle above the straight line between its ends", () => {
    expect(route[2][0]).toBeCloseTo(-0.1);
    expect(route[2][1]).toBeGreaterThan((route[0][1] + route[4][1]) / 2 + 0.04);
  });

  it("hangs below that line with a negative lift, and a bare end grips where it is", () => {
    const hanging = routeOf({
      ends: ["bare", "bare"],
      from: [0, 0.2, 0],
      lift: -0.1,
      to: [0.4, 0.2, 0],
    });
    expect(hanging[0]).toEqual([0, 0.2, 0]);
    expect(hanging[2][1]).toBeLessThan(0.2);
  });
});
