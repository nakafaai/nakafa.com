// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Element } from "@repo/design-system/components/three/molecule/element";
import {
  bilayerOf,
  dropletOf,
  lipidOf,
} from "@repo/design-system/components/three/molecule/lipid";
import {
  cross,
  dot,
  length,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Option } from "effect";

/** How many atoms of each element a molecule has. */
function formulaOf(molecule: Molecule) {
  const count = (element: Element) =>
    Arr.filter(molecule.atoms, (atom) => atom.element === element).length;
  return {
    C: count("C"),
    H: count("H"),
    N: count("N"),
    O: count("O"),
    P: count("P"),
  };
}

/** The length of every bond of a molecule, in angstrom. */
function spansOf(molecule: Molecule) {
  return Arr.map(molecule.bonds, (bond) =>
    length(
      sub(
        molecule.atoms[bond.from]?.at ?? [0, 0, 0],
        molecule.atoms[bond.to]?.at ?? [9, 9, 9]
      )
    )
  );
}

/** The smallest distance between two atoms that are not bonded to each other. */
function clearanceOf(molecule: Molecule) {
  const heavy = Arr.filter(molecule.atoms, (atom) => atom.element !== "H");
  return Arr.reduce(heavy, 99, (least, atom, index) =>
    Arr.reduce(Arr.drop(heavy, index + 1), least, (low, other) => {
      const gap = length(sub(atom.at, other.at));
      return gap > 1.7 ? Math.min(low, gap) : low;
    })
  );
}

/** The smallest distance between atoms of two different lipids of a crowd whose lipids have `one` atoms each. */
function crampOf(molecule: Molecule, one: number) {
  return Arr.reduce(molecule.atoms, 99, (least, atom, index) =>
    Arr.reduce(
      Arr.drop(molecule.atoms, (Math.floor(index / one) + 1) * one),
      least,
      (low, other) => Math.min(low, length(sub(atom.at, other.at)))
    )
  );
}

describe("a lipid as its atoms", () => {
  it("builds tristearin as C57H110O6 with three ester bonds", () => {
    const fat = lipidOf("triglyceride", false);
    expect(formulaOf(fat.molecule)).toEqual({
      C: 57,
      H: 110,
      N: 0,
      O: 6,
      P: 0,
    });
    Arr.forEach(spansOf(fat.molecule), (span) => {
      expect(span).toBeGreaterThan(0.9);
      expect(span).toBeLessThan(1.56);
    });
    expect(clearanceOf(fat.molecule)).toBeGreaterThan(2.2);
    expect(
      Arr.filter(fat.molecule.bonds, (bond) => bond.order === 2)
    ).toHaveLength(3);
    expect(Arr.map(fat.molecule.atoms, (atom) => atom.part)).toContain(3);
    expect(fat.ester[1]).toBeGreaterThan(fat.kink[1] + 8);
  });

  it("hangs all three tails of a fat straight down", () => {
    const fat = lipidOf("triglyceride", false).molecule;
    Arr.forEach([1, 2, 3], (part) => {
      const tail = Arr.filter(
        fat.atoms,
        (atom) => atom.part === part && atom.element === "C"
      );
      const lows = Arr.map(tail, (atom) => atom.at[1]);
      const sides = Arr.map(tail, (atom) => atom.at[0]);
      expect(Math.max(...lows) - Math.min(...lows)).toBeGreaterThan(19);
      expect(Math.max(...sides) - Math.min(...sides)).toBeLessThan(3.2);
    });
  });

  it("kinks the last fatty acid of an unsaturated fat at a cis double bond", () => {
    const straight = lipidOf("triglyceride", false).molecule;
    const kinked = lipidOf("triglyceride", true).molecule;
    expect(formulaOf(kinked)).toMatchObject({ C: 57, H: 108 });
    expect(Arr.filter(kinked.bonds, (bond) => bond.order === 2)).toHaveLength(
      4
    );
    const spread = (molecule: Molecule) => {
      const sides = Arr.map(
        Arr.filter(molecule.atoms, (atom) => atom.part === 3),
        (atom) => Math.hypot(atom.at[0], atom.at[2])
      );
      return Math.max(...sides) - Math.min(...sides);
    };
    expect(spread(kinked)).toBeGreaterThan(spread(straight) + 2);
    expect(clearanceOf(kinked)).toBeGreaterThan(2.2);
    expect(
      Math.min(...Arr.filter(spansOf(kinked), (span) => span > 1.3))
    ).toBeCloseTo(1.34, 2);
  });

  it("builds phosphatidylcholine, its phosphate protonated, with its head above two tails", () => {
    const lipid = lipidOf("phospholipid", true);
    expect(formulaOf(lipid.molecule)).toEqual({
      C: 44,
      H: 87,
      N: 1,
      O: 8,
      P: 1,
    });
    const head = Arr.filter(lipid.molecule.atoms, (atom) => atom.part === 4);
    expect(head.length).toBeGreaterThan(10);
    Arr.forEach(head, (atom) => {
      expect(atom.at[1]).toBeGreaterThan(1);
    });
    Arr.forEach(spansOf(lipid.molecule), (span) => {
      expect(span).toBeGreaterThan(0.9);
      expect(span).toBeLessThan(1.65);
    });
    expect(clearanceOf(lipid.molecule)).toBeGreaterThan(2.2);
    expect(Arr.some(lipid.molecule.atoms, (atom) => atom.part === 3)).toBe(
      false
    );
    expect(lipid.kink[1]).toBeLessThan(lipid.ester[1]);
  });

  it("gives the middle carbon of the membrane lipid its natural R hand", () => {
    const { atoms } = lipidOf("phospholipid", false).molecule;
    const from = (index: number) =>
      sub(atoms[index]?.at ?? [0, 0, 0], atoms[1]?.at ?? [9, 9, 9]);
    const oxygen = Arr.findFirstIndex(
      atoms,
      (atom) =>
        atom.element === "O" &&
        atom.part === 0 &&
        Math.abs(length(sub(atom.at, atoms[1]?.at ?? [9, 9, 9])) - 1.43) < 0.01
    );
    expect(Option.isSome(oxygen)).toBe(true);
    const hand = dot(
      cross(from(Option.getOrElse(oxygen, () => 0)), from(2)),
      from(0)
    );
    expect(hand).toBeLessThan(-1);
  });

  it("lays two leaflets of heavy atoms tail to tail", () => {
    const bilayer = bilayerOf(false, 3, 4);
    const one = Arr.filter(
      lipidOf("phospholipid", false).molecule.atoms,
      (atom) => atom.element !== "H"
    ).length;
    expect(bilayer.atoms).toHaveLength(one * 24);
    expect(bilayer.bonds).toHaveLength(0);
    const phosphorus = Arr.filter(
      bilayer.atoms,
      (atom) => atom.element === "P"
    );
    expect(Arr.filter(phosphorus, (atom) => atom.at[1] > 20)).toHaveLength(12);
    expect(Arr.filter(phosphorus, (atom) => atom.at[1] < -20)).toHaveLength(12);
    Arr.forEach(bilayer.atoms, (atom) => {
      expect(Math.abs(atom.at[1])).toBeGreaterThanOrEqual(0.79);
    });
    expect(crampOf(bilayer, one)).toBeGreaterThan(3.4);
  });

  it("gives kinked membrane lipids more room and less order", () => {
    const width = (molecule: Molecule) => {
      const sides = Arr.map(molecule.atoms, (atom) => atom.at[0]);
      return Math.max(...sides) - Math.min(...sides);
    };
    const heights = (molecule: Molecule) =>
      Arr.dedupe(
        Arr.map(
          Arr.filter(molecule.atoms, (atom) => atom.element === "P"),
          (atom) => Math.abs(atom.at[1]).toFixed(2)
        )
      ).length;
    const gel = bilayerOf(false, 2, 4);
    const fluid = bilayerOf(true, 2, 4);
    const depth = (molecule: Molecule) => {
      const sides = Arr.map(molecule.atoms, (atom) => atom.at[2]);
      return Math.max(...sides) - Math.min(...sides);
    };
    expect(width(fluid) * depth(fluid)).toBeGreaterThan(
      width(gel) * depth(gel) * 1.1
    );
    expect(heights(gel)).toBe(1);
    expect(heights(fluid)).toBeGreaterThan(8);
    expect(crampOf(fluid, 54)).toBeGreaterThan(2.4);
  });

  it("clumps fat into a droplet whose tails meet in the middle", () => {
    const solid = dropletOf(false);
    const oil = dropletOf(true);
    const one = Arr.filter(
      lipidOf("triglyceride", false).molecule.atoms,
      (atom) => atom.element !== "H"
    ).length;
    expect(solid.atoms.length % one).toBe(0);
    expect(solid.atoms.length / one).toBe(22);
    expect(oil.atoms).toHaveLength(solid.atoms.length);
    const oxygens = Arr.filter(solid.atoms, (atom) => atom.element === "O");
    Arr.forEach(oxygens, (atom) => {
      expect(Math.abs(atom.at[1])).toBeGreaterThan(18);
    });
    expect(crampOf(solid, one)).toBeGreaterThan(3.4);
    expect(crampOf(oil, one)).toBeGreaterThan(2.4);
    expect(Arr.some(solid.atoms, (atom) => atom.element === "P")).toBe(false);
  });
});
