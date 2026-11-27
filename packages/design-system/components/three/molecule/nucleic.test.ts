import { describe, expect, it } from "@effect/vitest";
import type { Step } from "@repo/design-system/components/three/molecule/nucleic";
import {
  duplexOf,
  HELIX_RISE,
  HELIX_TURN,
  helixOf,
  nucleotideOf,
} from "@repo/design-system/components/three/molecule/nucleic";
import {
  length,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr } from "effect";

/** How many atoms of each element a molecule has, as a formula. */
function formulaOf(molecule: Molecule) {
  return Arr.join(
    Arr.map(["C", "H", "N", "O", "P"], (element) => {
      const count = Arr.filter(
        molecule.atoms,
        (atom) => atom.element === element
      ).length;
      return `${element}${count}`;
    }),
    " "
  );
}

/** The length of every bond of a molecule, in angstrom. */
function bondLengths(molecule: Molecule) {
  return Arr.map(molecule.bonds, (bond) =>
    length(
      sub(
        molecule.atoms[bond.to]?.at ?? [0, 0, 0],
        molecule.atoms[bond.from]?.at ?? [9, 9, 9]
      )
    )
  );
}

/** A step of a straight helix with the given bases. */
function step(
  index: number,
  first: Step["first"],
  second: Step["second"],
  sugar: Step["sugar"] = "deoxyribose"
): Step {
  return {
    first,
    rise: index * HELIX_RISE,
    second,
    shift: 0,
    sugar,
    turn: index * HELIX_TURN,
  };
}

describe("nucleotideOf", () => {
  it("builds each deoxynucleotide with every atom of its formula", () => {
    expect(formulaOf(nucleotideOf("A"))).toBe("C10 H14 N5 O6 P1");
    expect(formulaOf(nucleotideOf("G"))).toBe("C10 H14 N5 O7 P1");
    expect(formulaOf(nucleotideOf("C"))).toBe("C9 H14 N3 O7 P1");
    expect(formulaOf(nucleotideOf("T"))).toBe("C10 H15 N2 O8 P1");
    expect(formulaOf(nucleotideOf("U"))).toBe("C9 H13 N2 O8 P1");
  });

  it("keeps every bond at a real length and splits the atoms into three parts", () => {
    const adenosine = nucleotideOf("A");
    const lengths = bondLengths(adenosine);
    expect(Math.min(...lengths)).toBeGreaterThan(0.95);
    expect(Math.max(...lengths)).toBeLessThan(1.62);
    expect(
      Arr.map(
        [0, 1, 2],
        (part) =>
          Arr.filter(
            adenosine.atoms,
            (atom) => atom.part === part && atom.element !== "H"
          ).length
      )
    ).toEqual([5, 7, 10]);
  });
});

describe("helixOf", () => {
  const duplex = helixOf(duplexOf(["G", "A", "T", "C", "U"]));

  it("closes both backbones with real bond lengths at the helix's rise and turn", () => {
    const lengths = bondLengths(duplex);
    expect(Math.min(...lengths)).toBeGreaterThan(1.2);
    expect(Math.max(...lengths)).toBeLessThan(1.62);
    expect(Arr.filter(lengths, (size) => size > 1.6)).toHaveLength(8 + 2);
  });

  it("ties Watson and Crick pairs with two or three hydrogen bonds", () => {
    expect(duplex.ties).toHaveLength(3 + 2 + 2 + 3 + 2);
    const lengths = Arr.map(duplex.ties, ([from, to]) => length(sub(to, from)));
    expect(Math.min(...lengths)).toBeGreaterThan(2.7);
    expect(Math.max(...lengths)).toBeLessThan(3.1);
    expect(helixOf([step(0, "A", "G")]).ties).toEqual([]);
  });

  it("numbers each residue's atoms as one part and traces each strand", () => {
    expect(Math.max(...Arr.map(duplex.atoms, (atom) => atom.part))).toBe(9);
    expect(duplex.traces).toHaveLength(2);
    expect(Arr.map(duplex.traces, (trace) => trace.length)).toEqual([10, 10]);
    expect(
      Arr.filter(duplex.atoms, (atom) => atom.part === 0 && atom.spine)
    ).toHaveLength(7);
  });

  it("keeps the helix 20 angstrom across at the phosphates", () => {
    const radii = Arr.map(
      Arr.filter(duplex.atoms, (atom) => atom.element === "P"),
      (atom) => Math.hypot(atom.at[0], atom.at[1])
    );
    expect(Math.min(...radii)).toBeCloseTo(9.27, 1);
    expect(Math.max(...radii)).toBeCloseTo(9.27, 1);
  });

  it("builds single strands, gaps and RNA", () => {
    const strand = helixOf([
      step(0, "A", undefined, "ribose"),
      step(1, "U", undefined, "ribose"),
      step(2, undefined, "C"),
      step(3, "G", "C"),
    ]);
    expect(strand.traces).toHaveLength(3);
    expect(strand.ties).toHaveLength(3);
    const oxygens = Arr.filter(
      strand.atoms,
      (atom) => atom.part === 2 && atom.element === "O"
    );
    expect(oxygens).toHaveLength(8);
    const ends = Arr.filter(
      strand.atoms,
      (atom) => atom.part === 6 && atom.element === "O"
    );
    expect(ends).toHaveLength(7);
  });

  it("pushes a shifted pair sideways", () => {
    const [atom] = helixOf([{ ...step(0, "A", undefined), shift: 5 }]).atoms;
    expect(atom?.at[1]).toBeCloseTo(9.267 + 5, 9);
  });
});
