// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BEAD,
  POT,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";
import {
  beadProfile,
  looseBeads,
  POT_FLOOR,
  potProfile,
} from "@repo/design-system/components/contents/mathematics/abacus/shape";
import { Array as Arr, Option } from "effect";

describe("the turned profiles", () => {
  it("traces a bead as wide and as tall as a real one, bored to slide on a spike", () => {
    const points = beadProfile();
    const radii = Arr.map(points, ([radius]) => radius);
    const heights = Arr.map(points, ([, height]) => height);
    expect(Math.max(...radii)).toBeCloseTo(BEAD.radius, 10);
    expect(Math.min(...radii)).toBeCloseTo(BEAD.bore, 10);
    expect(Math.max(...heights)).toBeCloseTo(BEAD.height / 2, 10);
    expect(Math.min(...heights)).toBeCloseTo(-BEAD.height / 2, 10);
    expect(points[0]?.[1]).toBeCloseTo(-BEAD.height / 2, 10);
  });

  it("traces the pot from its foot up the outside and down to a floor below its rim", () => {
    const points = potProfile();
    expect(points[0]).toEqual([0.0001, 0]);
    expect(Math.max(...Arr.map(points, ([, height]) => height))).toBe(
      POT.height
    );
    expect(Option.getOrThrow(Arr.last(points))[1]).toBeCloseTo(POT_FLOOR, 10);
    expect(POT_FLOOR).toBeGreaterThan(0);
    expect(POT_FLOOR).toBeLessThan(POT.height);
  });

  it("lays the loose beads apart from each other, the wall and the middle", () => {
    const beads = looseBeads();
    expect(beads).toHaveLength(5);
    Arr.forEach(beads, (bead, index) => {
      const fromMiddle = Math.hypot(bead.x - POT.x, bead.z);
      expect(fromMiddle - BEAD.radius).toBeGreaterThan(BEAD.radius);
      expect(fromMiddle + BEAD.radius).toBeLessThan(POT.radius - POT.wall);
      expect(bead.y - BEAD.height / 2).toBeGreaterThanOrEqual(POT_FLOOR);
      const next = beads[(index + 1) % beads.length];
      expect(
        Math.hypot(bead.x - (next?.x ?? 0), bead.z - (next?.z ?? 0))
      ).toBeGreaterThan(2 * BEAD.radius);
    });
  });
});
