import { describe, expect, it } from "@effect/vitest";
import {
  clampPosition,
  PAIRS,
  PLANES,
  pairAxis,
  planePose,
  SECTIONS,
  stemSlice,
} from "@repo/design-system/components/contents/biology/planes/anatomy";
import { Array as Arr } from "effect";

describe("clampPosition", () => {
  it("clamps values into [-1, 1]", () => {
    expect(clampPosition(-2)).toBe(-1);
    expect(clampPosition(0.4)).toBe(0.4);
    expect(clampPosition(3)).toBe(1);
  });
});

describe("planePose", () => {
  it("moves sagittal along X, frontal along Z, and transverse along Y", () => {
    const sagittal = planePose("sagittal", 1);
    expect(sagittal.position[0]).toBeGreaterThan(0);
    expect(sagittal.rotation[1]).toBeCloseTo(Math.PI / 2, 6);

    const frontal = planePose("frontal", -1);
    expect(frontal.position[2]).toBeLessThan(0);
    expect(frontal.rotation).toEqual([0, 0, 0]);

    const transverse = planePose("transverse", 1);
    expect(transverse.position[1]).toBeGreaterThan(1.4);
    expect(transverse.rotation[0]).toBeCloseTo(Math.PI / 2, 6);
  });

  it("handles every declared anatomical plane", () => {
    expect(Arr.map(PLANES, (plane) => planePose(plane, 0).size)).toHaveLength(
      3
    );
  });
});

describe("pairAxis", () => {
  it("defines distinct start and end markers for every anatomical direction pair", () => {
    for (const pair of PAIRS) {
      const axis = pairAxis(pair);
      const distance = Math.hypot(
        axis.end[0] - axis.start[0],
        axis.end[1] - axis.start[1],
        axis.end[2] - axis.start[2]
      );
      expect(distance).toBeGreaterThan(0.2);
    }
  });
});

describe("stemSlice", () => {
  it("generates ten evenly spaced vascular bundles and valid section poses", () => {
    const transverse = stemSlice("transverse", 0.5);
    expect(transverse.bundles).toHaveLength(10);
    expect(transverse.position[1]).toBeGreaterThan(0.65);

    const longitudinal = stemSlice("longitudinal", -0.5);
    expect(longitudinal.position[0]).toBeLessThan(0);
    expect(
      Arr.map(SECTIONS, (section) => stemSlice(section, 0).size)
    ).toHaveLength(2);
  });
});
