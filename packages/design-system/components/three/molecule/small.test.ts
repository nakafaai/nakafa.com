// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Element } from "@repo/design-system/components/three/molecule/element";
import {
  length,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { smallOf } from "@repo/design-system/components/three/molecule/small";
import { Array as Arr } from "effect";

/** How many atoms of each element a molecule has, as its formula. */
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

describe("the small molecules of metabolism", () => {
  it("builds water, oxygen and carbon dioxide at their bond lengths", () => {
    expect(formulaOf(smallOf("water"))).toMatchObject({ H: 2, O: 1 });
    expect(spansOf(smallOf("water"))[0]).toBeCloseTo(0.9572, 3);
    expect(smallOf("oxygen").bonds).toEqual([{ from: 0, order: 2, to: 1 }]);
    expect(spansOf(smallOf("oxygen"))[0]).toBeCloseTo(1.208);
    expect(formulaOf(smallOf("carbonDioxide"))).toMatchObject({ C: 1, O: 2 });
    expect(spansOf(smallOf("carbonDioxide"))).toEqual([1.163, 1.163]);
  });

  it("builds glucose as C6H12O6 in its chair", () => {
    const glucose = smallOf("glucose");
    expect(formulaOf(glucose)).toEqual({ C: 6, H: 12, N: 0, O: 6, P: 0 });
    Arr.forEach(spansOf(glucose), (span) => {
      expect(span).toBeGreaterThan(0.9);
      expect(span).toBeLessThan(1.56);
    });
  });

  it("builds ATP as C10H16N5O13P3 with three phosphates in a chain", () => {
    const atp = smallOf("atp");
    expect(formulaOf(atp)).toEqual({ C: 10, H: 16, N: 5, O: 13, P: 3 });
    const [alpha, beta, gamma] = Arr.filter(
      atp.atoms,
      (atom) => atom.element === "P"
    );
    expect(
      length(sub(alpha?.at ?? [0, 0, 0], beta?.at ?? [0, 0, 0]))
    ).toBeCloseTo(2.9, 1);
    expect(
      length(sub(beta?.at ?? [0, 0, 0], gamma?.at ?? [0, 0, 0]))
    ).toBeCloseTo(2.9, 1);
    Arr.forEach(spansOf(atp), (span) => {
      expect(span).toBeGreaterThan(0.9);
      expect(span).toBeLessThan(1.7);
    });
  });

  it("builds NADPH as C21H30N7O17P3 from its two nucleotides", () => {
    const nadph = smallOf("nadph");
    expect(formulaOf(nadph)).toEqual({ C: 21, H: 30, N: 7, O: 17, P: 3 });
    expect(Arr.some(nadph.atoms, (atom) => atom.part === 3)).toBe(true);
    Arr.forEach(spansOf(nadph), (span) => {
      expect(span).toBeGreaterThan(0.9);
      expect(span).toBeLessThan(1.7);
    });
    const [first, , second] = Arr.filter(
      nadph.atoms,
      (atom) => atom.element === "P"
    );
    expect(
      length(sub(first?.at ?? [0, 0, 0], second?.at ?? [0, 0, 0]))
    ).toBeCloseTo(2.9, 1);
  });
});
