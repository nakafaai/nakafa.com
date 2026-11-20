// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  AORTA,
  LEFT_ATRIUM,
  LEFT_CAVITY,
  LEFT_WALL,
  place,
  RIGHT_ATRIUM,
  RIGHT_CAVITY,
  RIGHT_WALL,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  cavityField,
  cutDepth,
  grooveDepth,
  heartField,
  outerField,
  vesselField,
} from "@repo/design-system/components/contents/biology/heart/field";
import { Array as Arr } from "effect";

/**
 * The stretches of solid tissue a line meets as it crosses the heart at
 * `along` cm down its long axis and `depth` cm deep, from one side to the
 * other, each as its width in centimetres, leaving out the thin ridges of
 * the trabeculae it grazes.
 */
function wallsAcross(along: number, depth: number) {
  const step = 0.01;
  const inside = Arr.map(Arr.range(-600, 600), (index) => {
    const [x, y, z] = place(along, index * step, depth);
    return heartField(x, y, z) < 0;
  });
  const none: readonly number[] = [];
  return Arr.reduce(inside, { open: 0, walls: none }, (state, solid) => {
    if (solid) {
      return { ...state, open: state.open + step };
    }
    // A ridge of trabeculae grazed by the line is not a wall.
    return state.open > 0.1
      ? { open: 0, walls: [...state.walls, state.open] }
      : { ...state, open: 0 };
  }).walls;
}

describe("the heart's size", () => {
  it("is about the size of a fist: 12 cm long, 8 to 9 cm wide, 6 cm thick", () => {
    // OpenStax Anatomy and Physiology 2e, 19.1.
    const apex = LEFT_WALL.along + LEFT_WALL.radii[0];
    const roof = Math.min(
      RIGHT_ATRIUM.along - RIGHT_ATRIUM.radii[0],
      LEFT_ATRIUM.along - LEFT_ATRIUM.radii[0]
    );
    const left = LEFT_WALL.across + LEFT_WALL.radii[1];
    const right = RIGHT_CAVITY.across - RIGHT_CAVITY.radii[1] - RIGHT_WALL;
    expect(apex - roof).toBeGreaterThan(11);
    expect(apex - roof).toBeLessThan(13);
    expect(left - right).toBeGreaterThan(8);
    expect(left - right).toBeLessThan(9.5);
    expect(2 * LEFT_WALL.radii[2]).toBe(6);
  });

  it("opens the left ventricle 4.6 cm across", () => {
    // Lang 2015, Table 2: 4.2 to 5.8 cm in men, 3.8 to 5.2 cm in women.
    expect(2 * LEFT_CAVITY.radii[1]).toBeCloseTo(4.6, 9);
  });

  it("sizes the aortic root as an adult's", () => {
    // Lang 2015, Table 14: annulus 2.3 to 2.6 cm, sinuses 3.0 to 3.4 cm.
    const [annulus, sinus] = AORTA;
    expect(2 * (annulus?.[3] ?? 0)).toBeGreaterThan(2.2);
    expect(2 * (annulus?.[3] ?? 0)).toBeLessThan(2.7);
    expect(2 * (sinus?.[3] ?? 0)).toBeGreaterThan(2.9);
    expect(2 * (sinus?.[3] ?? 0)).toBeLessThan(3.5);
  });
});

describe("the ventricular walls", () => {
  const walls = wallsAcross(3.3, -0.1);

  it("crosses the right wall, the septum and the left wall in turn", () => {
    expect(walls).toHaveLength(3);
  });

  it("makes the left wall and the septum about three times the right wall", () => {
    // Lang 2015: septum and free wall 0.6 to 1.0 cm, right wall 0.1 to 0.5 cm.
    const [right = 0, septum = 0, left = 0] = walls;
    expect(right).toBeGreaterThan(0.2);
    expect(right).toBeLessThan(0.5);
    expect(septum).toBeGreaterThan(0.6);
    expect(septum).toBeLessThan(1.1);
    expect(left).toBeGreaterThan(0.6);
    expect(left).toBeLessThan(1.1);
    expect(left / right).toBeGreaterThan(2);
    expect(left / right).toBeLessThan(4);
  });
});

describe("the chambers", () => {
  it("walls the right atrium thinly", () => {
    const [atrium = 0] = wallsAcross(-2.0, -0.7);
    expect(atrium).toBeGreaterThan(0.15);
    expect(atrium).toBeLessThan(0.35);
  });

  it("keeps the two atria apart behind the interatrial septum", () => {
    const septum = Arr.some(Arr.range(0, 100), (index) => {
      const share = index / 100;
      const [x, y, z] = place(
        RIGHT_ATRIUM.along + (LEFT_ATRIUM.along - RIGHT_ATRIUM.along) * share,
        RIGHT_ATRIUM.across +
          (LEFT_ATRIUM.across - RIGHT_ATRIUM.across) * share,
        RIGHT_ATRIUM.depth + (LEFT_ATRIUM.depth - RIGHT_ATRIUM.depth) * share
      );
      return cavityField(x, y, z) > 0.1;
    });
    expect(septum).toBe(true);
  });

  it("is cut open from the front", () => {
    const [x, y] = place(LEFT_CAVITY.along, LEFT_CAVITY.across, 0);
    expect(heartField(x, y, cutDepth(x, y) + 1)).toBeGreaterThan(0);
    expect(heartField(x, y, cutDepth(x, y) + 0.3)).toBeGreaterThan(0);
    expect(heartField(20, 0, -1)).toBeGreaterThan(0);
    expect(outerField(x, y, -1)).toBeLessThan(0);
    expect(heartField(0, 12, 0)).toBeGreaterThan(0);
  });
});

describe("the surface", () => {
  it("finds the grooves between the chambers and the walls of the vessels", () => {
    const [x, y] = place(0.3, 3.5, -1.5);
    expect(grooveDepth(x, y, -1.5)).toBeGreaterThan(0.3);
    expect(
      grooveDepth(...place(LEFT_CAVITY.along, LEFT_CAVITY.across, -3.2))
    ).toBe(0);
    expect(vesselField(-3.45, 4.8, -1.0, "vein")).toBeLessThan(0);
    expect(vesselField(-3.45, 4.8, -1.0, "artery")).toBeGreaterThan(0);
    expect(vesselField(-1.5, 4.6, 0.2, "artery")).toBeLessThan(0);
  });
});
