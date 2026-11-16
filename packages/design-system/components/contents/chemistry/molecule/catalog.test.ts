import { describe, expect, it } from "@effect/vitest";
import {
  countAtoms,
  getMolecule,
  MoleculeIdSchema,
  pyramidDihedral,
  relativeMass,
  TETRAHEDRAL_ANGLE,
} from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import {
  measureAngle,
  measureDistance,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr, Result } from "effect";

function molecule(id: (typeof MoleculeIdSchema.literals)[number]) {
  return Result.getOrThrow(getMolecule(id));
}

function distance(
  id: (typeof MoleculeIdSchema.literals)[number],
  first: number,
  second: number
) {
  const { atoms } = molecule(id);
  return measureDistance(
    Arr.getUnsafe(atoms, first).position,
    Arr.getUnsafe(atoms, second).position
  );
}

function angle(
  id: (typeof MoleculeIdSchema.literals)[number],
  first: number,
  vertex: number,
  second: number
) {
  const { atoms } = molecule(id);
  return measureAngle(
    Arr.getUnsafe(atoms, first).position,
    Arr.getUnsafe(atoms, vertex).position,
    Arr.getUnsafe(atoms, second).position
  );
}

describe("molecule catalog", () => {
  it("builds every molecule with one bond fewer than its atoms", () => {
    for (const id of MoleculeIdSchema.literals) {
      const built = molecule(id);
      expect(built.bonds).toHaveLength(built.atoms.length - 1);
    }
  });

  it("keeps the measured bond lengths and angles of water", () => {
    expect(distance("water", 0, 1)).toBeCloseTo(95.8, 6);
    expect(distance("water", 0, 2)).toBeCloseTo(95.8, 6);
    expect(angle("water", 1, 0, 2)).toBeCloseTo(104.5, 6);
    expect(molecule("water").angle).toEqual({ arms: [1, 2], vertex: 0 });
  });

  it("gives every pair of ammonia and methane bonds the same angle", () => {
    for (const [first, second] of [
      [1, 2],
      [1, 3],
      [2, 3],
    ] as const) {
      expect(angle("ammonia", first, 0, second)).toBeCloseTo(106.7, 6);
      expect(angle("methane", first, 0, second)).toBeCloseTo(
        TETRAHEDRAL_ANGLE,
        6
      );
    }
    expect(angle("methane", 1, 0, 4)).toBeCloseTo(TETRAHEDRAL_ANGLE, 6);
    expect(angle("methane", 3, 0, 4)).toBeCloseTo(TETRAHEDRAL_ANGLE, 6);
    expect(pyramidDihedral(TETRAHEDRAL_ANGLE)).toBeCloseTo(120, 9);
  });

  it("keeps straight molecules straight and flat ones flat", () => {
    expect(angle("carbon-dioxide", 1, 0, 2)).toBeCloseTo(180, 6);
    expect(angle("ethyne", 2, 0, 1)).toBeCloseTo(180, 6);
    expect(angle("ethyne", 0, 1, 3)).toBeCloseTo(180, 6);
    expect(angle("ethene", 2, 0, 3)).toBeCloseTo(117.4, 6);
    expect(angle("sulfur-trioxide", 2, 0, 3)).toBeCloseTo(120, 6);
    expect(
      Arr.every(
        molecule("ethene").atoms,
        (atom) => Math.abs(atom.position[2]) < 1e-9
      )
    ).toBe(true);
  });

  it("staggers the hydrogens of ethane at their measured angle", () => {
    for (const hydrogen of [2, 3, 4]) {
      expect(distance("ethane", 0, hydrogen)).toBeCloseTo(109.4, 6);
      expect(angle("ethane", 1, 0, hydrogen)).toBeCloseTo(111.2, 6);
    }
    for (const hydrogen of [5, 6, 7]) {
      expect(angle("ethane", 0, 1, hydrogen)).toBeCloseTo(111.2, 6);
    }
  });

  it("bends propane, ethanol, and hydrogen peroxide at their chain angles", () => {
    expect(angle("propane", 0, 1, 2)).toBeCloseTo(112.4, 6);
    expect(angle("ethanol", 0, 1, 2)).toBeCloseTo(107.8, 6);
    expect(angle("ethanol", 1, 2, 3)).toBeCloseTo(105.4, 6);
    expect(angle("methanol", 0, 1, 2)).toBeCloseTo(108.5, 6);
    expect(distance("methanol", 0, 1)).toBeCloseTo(142.7, 6);
    expect(angle("hydrogen-peroxide", 2, 0, 1)).toBeCloseTo(94.8, 6);
    expect(distance("hydrogen-peroxide", 0, 1)).toBeCloseTo(147.5, 6);
  });

  it("counts atoms in the order of the periodic table", () => {
    expect(countAtoms("ethanol")).toEqual([
      ["H", 6],
      ["C", 2],
      ["O", 1],
    ]);
    expect(countAtoms("sulfur-trioxide")).toEqual([
      ["O", 3],
      ["S", 1],
    ]);
  });

  it("adds the school relative atomic masses", () => {
    expect(relativeMass("water")).toBe(18);
    expect(relativeMass("carbon-dioxide")).toBe(44);
    expect(relativeMass("hydrogen-chloride")).toBe(36.5);
    expect(relativeMass("ethanol")).toBe(46);
  });
});
