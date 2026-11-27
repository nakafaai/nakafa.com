import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  dot,
  length,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import { saturate } from "@repo/design-system/components/three/molecule/saturate";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Option } from "effect";

/** A molecule from its heavy atoms and bonds, all in one part. */
function build(
  atoms: readonly (readonly ["C" | "N" | "O", Point])[],
  bonds: readonly (readonly [number, number, 1 | 2])[]
): Molecule {
  return {
    atoms: Arr.map(atoms, ([element, at]) => ({
      at,
      element,
      part: 3,
      spine: false,
    })),
    bonds: Arr.map(bonds, ([from, to, order]) => ({ from, order, to })),
    ties: [],
    traces: [],
  };
}

/** The hydrogens bonded to atom `index`, as directions and distances from it. */
function hydrogensOf(molecule: Molecule, index: number) {
  return Arr.flatMap(molecule.bonds, (bond) => {
    const atom = molecule.atoms[bond.to];
    const parent = molecule.atoms[index];
    if (bond.from !== index || atom?.element !== "H" || parent === undefined) {
      return [];
    }
    return [sub(atom.at, parent.at)];
  });
}

/** The angle between two directions, in degrees. */
function angle(a: Point, b: Point) {
  return (Math.acos(dot(unit(a), unit(b))) * 180) / Math.PI;
}

describe("saturate", () => {
  it("fills methanol to CH3OH with tetrahedral hydrogens", () => {
    const methanol = saturate(
      build(
        [
          ["C", [0, 0, 0]],
          ["O", [1.43, 0, 0]],
        ],
        [[0, 1, 1]]
      )
    );
    const methyl = hydrogensOf(methanol, 0);
    const hydroxyl = hydrogensOf(methanol, 1);
    expect(methyl).toHaveLength(3);
    expect(hydroxyl).toHaveLength(1);
    expect(length(methyl[0] ?? [0, 0, 0])).toBeCloseTo(1.09, 9);
    expect(length(hydroxyl[0] ?? [0, 0, 0])).toBeCloseTo(0.96, 9);
    expect(angle(methyl[0] ?? [0, 0, 0], [1, 0, 0])).toBeCloseTo(109.47, 1);
    expect(angle(methyl[0] ?? [0, 0, 0], methyl[1] ?? [0, 0, 0])).toBeCloseTo(
      109.47,
      1
    );
    expect(Option.getOrUndefined(Arr.last(methanol.atoms))).toMatchObject({
      element: "H",
      part: 3,
    });
  });

  it("gives a chain's middle carbon two hydrogens and staggers its ends", () => {
    const propane = saturate(
      build(
        [
          ["C", [-1.25, -0.88, 0]],
          ["C", [0, 0, 0]],
          ["C", [1.25, -0.88, 0]],
        ],
        [
          [0, 1, 1],
          [1, 2, 1],
        ]
      )
    );
    const middle = hydrogensOf(propane, 1);
    expect(middle).toHaveLength(2);
    expect(angle(middle[0] ?? [0, 0, 0], middle[1] ?? [0, 0, 0])).toBeCloseTo(
      109.47,
      1
    );
    expect(hydrogensOf(propane, 0)).toHaveLength(3);
    expect(
      Arr.filter(propane.atoms, (atom) => atom.element === "H")
    ).toHaveLength(8);
  });

  it("keeps an amide flat: two hydrogens on nitrogen and one on carbon, in plane", () => {
    const formamide = saturate(
      build(
        [
          ["N", [-1.16, 0.67, 0]],
          ["C", [0, 0, 0]],
          ["O", [1.06, 0.61, 0]],
        ],
        [
          [0, 1, 1],
          [1, 2, 2],
        ]
      )
    );
    const amine = hydrogensOf(formamide, 0);
    const formyl = hydrogensOf(formamide, 1);
    expect(amine).toHaveLength(2);
    expect(formyl).toHaveLength(1);
    expect(hydrogensOf(formamide, 2)).toEqual([]);
    expect(Arr.map([...amine, ...formyl], (bond) => bond[2])).toEqual([
      expect.closeTo(0, 9),
      expect.closeTo(0, 9),
      expect.closeTo(0, 9),
    ]);
    expect(angle(amine[0] ?? [0, 0, 0], amine[1] ?? [0, 0, 0])).toBeCloseTo(
      120,
      1
    );
  });

  it("leaves a lone atom and a bond to a missing atom as they are", () => {
    const lone = build([["O", [0, 0, 0]]], [[0, 4, 1]]);
    expect(saturate(lone).atoms).toHaveLength(1);
    expect(saturate(lone).bonds).toEqual(lone.bonds);
  });
});
