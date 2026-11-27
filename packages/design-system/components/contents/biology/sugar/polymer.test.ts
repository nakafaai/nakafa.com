import { describe, expect, it } from "@effect/vitest";
import {
  bondCount,
  chainOf,
  joinsOf,
  monomersOf,
  POLYSACCHARIDES,
  pairOf,
  SUGARS,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import {
  cross,
  dot,
  length,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr } from "effect";

/** How many atoms of each element a molecule has. */
function formulaOf(molecule: Molecule) {
  const count = (element: string) =>
    Arr.filter(molecule.atoms, (atom) => atom.element === element).length;
  return { C: count("C"), H: count("H"), O: count("O") };
}

/** The turn in degrees and the rise in angstrom from one unit of a chain to the next, measured on its second to fifth rings. */
function screwOf(centers: readonly (readonly [number, number, number])[]) {
  const step = (index: number) =>
    sub(centers[index + 1] ?? [0, 0, 0], centers[index] ?? [0, 0, 0]);
  const first = unit(sub(step(1), step(2)));
  const second = unit(sub(step(2), step(3)));
  return {
    hand: Math.sign(dot(cross(step(1), step(2)), step(3))),
    rise: Math.abs(dot(step(2), unit(cross(first, second)))),
    turn: (Math.acos(dot(first, second)) * 180) / Math.PI,
  };
}

describe("monomersOf", () => {
  it("maps maltose, sucrose, and lactose to their exact monomer pairs", () => {
    expect(monomersOf("maltose")).toEqual(["glucose", "glucose"]);
    expect(monomersOf("sucrose")).toEqual(["glucose", "fructose"]);
    expect(monomersOf("lactose")).toEqual(["glucose", "galactose"]);
    expect(SUGARS).toHaveLength(3);
  });
});

describe("bondCount", () => {
  it("returns units - 1 glycosidic bonds and never goes below zero", () => {
    expect(bondCount(2)).toBe(1);
    expect(bondCount(10)).toBe(9);
    expect(bondCount(1)).toBe(0);
  });
});

describe("pairOf", () => {
  it("builds every disaccharide as C12H22O11 from two whole C6H12O6 sugars", () => {
    Arr.forEach(SUGARS, (sugar) => {
      const pair = pairOf(sugar);
      expect(formulaOf(pair.molecule)).toEqual({ C: 12, H: 22, O: 11 });
      expect(formulaOf(pair.first)).toEqual({ C: 6, H: 12, O: 6 });
      expect(formulaOf(pair.second)).toEqual({ C: 6, H: 12, O: 6 });
      const [left, right] = pair.centers;
      expect(length(sub(pair.bridge, left))).toBeLessThan(4.2);
      expect(length(sub(pair.bridge, right))).toBeLessThan(4.2);
    });
  });

  it("names glucose first in sucrose, whose fructose is a five-membered ring", () => {
    const ringOf = (molecule: Molecule) =>
      Arr.filter(
        molecule.atoms,
        (atom) =>
          atom.element !== "H" &&
          Arr.filter(
            molecule.bonds,
            (bond) =>
              molecule.atoms[bond.from] === atom ||
              molecule.atoms[bond.to] === atom
          ).length > 1
      ).length;
    const sucrose = pairOf("sucrose");
    expect(sucrose.first.atoms[0]?.part).toBe(1);
    expect(sucrose.second.atoms[0]?.part).toBe(0);
    expect(ringOf(sucrose.first)).toBeGreaterThan(ringOf(sucrose.second) - 2);
    expect(pairOf("maltose").first.atoms[0]?.part).toBe(0);
  });

  it("keeps every pair of atoms of the two sugars apart", () => {
    Arr.forEach(SUGARS, (sugar) => {
      const { molecule } = pairOf(sugar);
      const heavy = Arr.filter(molecule.atoms, (atom) => atom.element !== "H");
      const bridged = Arr.filter(
        molecule.bonds,
        (bond) =>
          molecule.atoms[bond.from]?.part !== molecule.atoms[bond.to]?.part
      );
      expect(bridged).toHaveLength(1);
      const near = Arr.filter(
        Arr.flatMap(heavy, (atom) =>
          Arr.map(
            Arr.filter(heavy, (other) => other.part > atom.part),
            (other) => length(sub(other.at, atom.at))
          )
        ),
        (span) => span < 2.2
      );
      expect(near).toHaveLength(1);
    });
  });
});

describe("joinsOf", () => {
  it("joins one bond fewer than there are units, and never fewer than two units", () => {
    Arr.forEach(POLYSACCHARIDES, (polysaccharide) => {
      expect(joinsOf(polysaccharide, 12)).toHaveLength(11);
      expect(joinsOf(polysaccharide, 0)).toHaveLength(1);
    });
  });

  it("branches glycogen at carbon 6 behind the tip and lengthens each branch", () => {
    const joins = joinsOf("glycogen", 12);
    expect(Arr.map(joins, (join) => `${join.host}${join.oxygen}`)).toEqual([
      "0O4",
      "1O4",
      "2O4",
      "2O6",
      "4O4",
      "3O4",
      "6O4",
      "6O6",
      "8O4",
      "7O4",
      "10O4",
    ]);
    expect(Arr.every(joins, (join) => join.anomer === "alpha")).toBe(true);
    expect(
      Arr.every(joinsOf("starch", 6), (join) => join.oxygen === "O4")
    ).toBe(true);
  });
});

describe("chainOf", () => {
  it("winds starch into amylose's left-handed helix, six units and 8 angstrom a turn", () => {
    const starch = chainOf("starch", 8);
    const screw = screwOf(starch.centers);
    expect(screw.turn).toBeGreaterThan(58);
    expect(screw.turn).toBeLessThan(62);
    expect(screw.rise * 6).toBeGreaterThan(7.4);
    expect(screw.rise * 6).toBeLessThan(8.6);
    expect(screw.hand).toBe(-1);
    expect(starch.ties).toEqual([]);
    expect(starch.beside).toBe(starch.molecule);
    expect(formulaOf(starch.molecule)).toEqual({ C: 48, H: 82, O: 41 });
  });

  it("lays cellulose as a flat ribbon, each unit half a turn and 5.3 angstrom on", () => {
    const cellulose = chainOf("cellulose", 8);
    const screw = screwOf(cellulose.centers);
    expect(screw.turn).toBeGreaterThan(178);
    expect(screw.rise).toBeGreaterThan(5.1);
    expect(screw.rise).toBeLessThan(5.4);
  });

  it("ties cellulose to the neighbouring chain of its sheet by hydrogen bonds", () => {
    const cellulose = chainOf("cellulose", 8);
    expect(cellulose.beside.atoms).toHaveLength(
      cellulose.molecule.atoms.length
    );
    expect(cellulose.beside.atoms[0]?.part).toBe(8);
    expect(cellulose.ties.length).toBeGreaterThan(7);
    Arr.forEach(cellulose.ties, ([from, to]) => {
      expect(length(sub(to, from))).toBeGreaterThan(2.6);
      expect(length(sub(to, from))).toBeLessThan(3.3);
    });
    const heavy = (molecule: Molecule) =>
      Arr.filter(molecule.atoms, (atom) => atom.element !== "H");
    const nearest = Math.min(
      ...Arr.flatMap(heavy(cellulose.molecule), (atom) =>
        Arr.map(heavy(cellulose.beside), (other) =>
          length(sub(other.at, atom.at))
        )
      )
    );
    expect(nearest).toBeGreaterThan(2.6);
  });

  it("builds glycogen with every unit and one bond fewer", () => {
    const glycogen = chainOf("glycogen", 12);
    expect(glycogen.centers).toHaveLength(12);
    expect(glycogen.bridges).toHaveLength(11);
    expect(formulaOf(glycogen.molecule)).toEqual({ C: 72, H: 122, O: 61 });
  });
});
