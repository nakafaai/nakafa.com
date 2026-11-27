import { describe, expect, it } from "@effect/vitest";
import { ELEMENTS } from "@repo/design-system/components/three/molecule/element";
import {
  dot,
  length,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import {
  centerOf,
  shapeOf,
} from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Option } from "effect";

/** Formaldehyde with one hydrogen left out: C=O with one C-H, the C marked as spine. */
const CARBONYL: Molecule = {
  atoms: [
    { at: [0, 0, 0], element: "C", part: 0, spine: true },
    { at: [1.2, 0, 0], element: "O", part: 1, spine: false },
    { at: [-0.55, 0.94, 0], element: "H", part: 1, spine: false },
  ],
  bonds: [
    { from: 0, order: 2, to: 1 },
    { from: 0, order: 1, to: 2 },
  ],
  ties: [
    [
      [1.2, 0, 0],
      [3.2, 0, 0],
    ],
  ],
  traces: [
    [
      [0, 0, 0],
      [1, 1, 1],
    ],
  ],
};

/** Carbon monoxide: one triple bond with no neighbour to set its plane. */
const MONOXIDE: Molecule = {
  atoms: [
    { at: [0, 0, 0], element: "C", part: 0, spine: false },
    { at: [0, 0, 1.13], element: "O", part: 0, spine: false },
  ],
  bonds: [{ from: 0, order: 3, to: 1 }],
  ties: [],
  traces: [],
};

describe("shapeOf", () => {
  it("draws a space-filling model at van der Waals radii with no rods", () => {
    const shape = shapeOf(CARBONYL, "spheres");
    expect(Arr.map(shape.balls, (ball) => ball.radius)).toEqual([
      ELEMENTS.C.reach,
      ELEMENTS.O.reach,
      ELEMENTS.H.reach,
    ]);
    expect(shape.rods).toEqual([]);
    expect(shape.tubes).toEqual([]);
  });

  it("draws a double bond as two rods in the plane of its neighbour", () => {
    const shape = shapeOf(CARBONYL, "sticks");
    expect(shape.rods).toHaveLength(6);
    const [first, , third] = shape.rods;
    const apart = sub(third?.from ?? [0, 0, 0], first?.from ?? [0, 0, 0]);
    expect(length(apart)).toBeCloseTo(0.38, 9);
    expect(dot(apart, [1, 0, 0])).toBeCloseTo(0, 9);
    expect(apart[2]).toBeCloseTo(0, 9);
    expect(first?.element).toBe("C");
    expect(shape.rods[1]?.element).toBe("O");
    expect(shape.rods[1]?.from).toEqual(first?.to);
  });

  it("finds the plane whichever way the neighbouring bond is written", () => {
    const turned: Molecule = {
      ...CARBONYL,
      bonds: [
        { from: 0, order: 2, to: 1 },
        { from: 2, order: 1, to: 0 },
      ],
    };
    expect(shapeOf(turned, "sticks").rods[0]).toEqual(
      shapeOf(CARBONYL, "sticks").rods[0]
    );
  });

  it("draws a triple bond as three rods even with no neighbour", () => {
    const shape = shapeOf(MONOXIDE, "sticks");
    expect(shape.rods).toHaveLength(6);
    expect(shape.balls).toHaveLength(2);
  });

  it("draws a ribbon's tubes and only the bonds clear of the spine", () => {
    const shape = shapeOf(CARBONYL, "ribbon");
    expect(shape.tubes).toHaveLength(CARBONYL.traces.length);
    expect(
      shapeOf(
        {
          ...CARBONYL,
          traces: [
            [
              [0, 0, 0],
              [1, 2, 0],
              [2, 0, 0],
            ],
          ],
        },
        "ribbon"
      ).tubes
    ).toEqual([
      [
        [0, 0, 0],
        [1, 1, 0],
        [2, 0, 0],
      ],
    ]);
    expect(shape.balls).toHaveLength(5);
    expect(
      Option.getOrUndefined(Arr.get(shape.balls, shape.balls.length - 2))
    ).toEqual({
      at: [2.2, 0, 0],
      element: "H",
      part: -1,
      radius: 0.1,
    });
    expect(shape.rods).toEqual([]);
    expect(shapeOf(MONOXIDE, "ribbon").rods).toHaveLength(2);
  });

  it("draws nothing for a bond that names a missing atom", () => {
    const broken: Molecule = {
      atoms: MONOXIDE.atoms,
      bonds: [
        { from: 0, order: 2, to: 7 },
        { from: 0, order: 2, to: 1 },
      ],
      ties: [],
      traces: [],
    };
    expect(shapeOf(broken, "sticks").rods).toHaveLength(4);
  });
});

describe("centerOf", () => {
  it("finds the middle of a part, and the origin of an empty one", () => {
    expect(centerOf(CARBONYL, 1)).toEqual([expect.closeTo(0.325, 9), 0.47, 0]);
    expect(centerOf(CARBONYL, 9)).toEqual([0, 0, 0]);
  });
});
