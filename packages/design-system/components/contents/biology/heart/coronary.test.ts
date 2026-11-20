// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { AXIS } from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  coronaryVessels,
  surfaceAt,
} from "@repo/design-system/components/contents/biology/heart/coronary";
import {
  cutDepth,
  grooveDepth,
  outerField,
} from "@repo/design-system/components/contents/biology/heart/field";
import { Array as Arr } from "effect";

const vessels = coronaryVessels();
const vessel = (index: number) => Arr.getUnsafe(vessels, index);
const right = vessel(0);
const posterior = vessel(1);
const middle = vessel(2);
const circumflex = vessel(3);
const great = vessel(4);
const sinus = vessel(5);

/** The first and last points of a course. */
const ends = (points: readonly (readonly [number, number, number])[]) =>
  [Arr.getUnsafe(points, 0), Arr.getUnsafe(points, points.length - 1)] as const;

/** How far along the heart's long axis a point lies. */
const along = ([x, y]: readonly [number, number, number]) =>
  x * AXIS[0] + y * AXIS[1];

describe("the heart's outer surface", () => {
  it("is found by a ray from the heart's middle", () => {
    Arr.forEach([0, 2, 5], (distance) => {
      Arr.forEach([0, -Math.PI / 2, Math.PI], (angle) => {
        const [x, y, z] = surfaceAt(distance, angle);
        expect(Math.abs(outerField(x, y, z))).toBeLessThan(0.01);
      });
    });
  });
});

describe("the coronary vessels", () => {
  it("lie in the grooves, behind the cut", () => {
    Arr.forEach(vessels, (vessel) => {
      expect(vessel.points.length).toBeGreaterThanOrEqual(4);
      const depths = Arr.map(vessel.points, ([x, y, z]) =>
        grooveDepth(x, y, z)
      );
      expect(
        Arr.reduce(depths, 0, (sum, depth) => sum + depth) / depths.length
      ).toBeGreaterThan(0.6);
      Arr.forEach(vessel.points, ([x, y, z]) => {
        expect(z).toBeLessThan(cutDepth(x, y) - vessel.radius);
        // Mostly buried in the groove's fat, never floating off it.
        expect(outerField(x, y, z)).toBeLessThan(vessel.radius);
      });
    });
  });

  it("run where the anatomy puts them", () => {
    // The right coronary artery comes round the right margin to the back.
    const [rightStart, rightEnd] = ends(right.points);
    expect(rightStart[0]).toBeLessThan(-3);
    expect(rightEnd[2]).toBeLessThan(-2.5);
    // The posterior interventricular artery and middle cardiac vein run down toward the apex.
    Arr.forEach([posterior, middle], ({ points }) => {
      const [top, bottom] = ends(points);
      expect(along(bottom) - along(top)).toBeGreaterThan(3.5);
    });
    // The circumflex artery runs round the left side to the back.
    const [leftStart, leftEnd] = ends(circumflex.points);
    expect(leftStart[0]).toBeGreaterThan(3);
    expect(leftEnd[2]).toBeLessThan(-2.5);
  });

  it("are as wide as angiography finds them, the coronary sinus widest", () => {
    // Dodge et al. 1992: proximal right coronary artery 3.9 ± 0.6 mm in a right-dominant heart.
    expect(2 * right.radius).toBeGreaterThan(0.33);
    expect(2 * right.radius).toBeLessThan(0.45);
    expect(circumflex.radius).toBeCloseTo(0.15, 2);
    expect(posterior.kind).toBe("artery");
    expect(middle.kind).toBe("vein");
    expect(sinus.radius).toBeGreaterThan(great.radius);
    expect(sinus.kind).toBe("vein");
  });
});
