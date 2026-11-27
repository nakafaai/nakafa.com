import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  cross,
  dot,
  length,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { glycanOf } from "@repo/design-system/components/three/molecule/sugar";
import { Array as Arr } from "effect";

/** How many atoms of each element a molecule has. */
function formulaOf(molecule: Molecule) {
  const count = (element: string) =>
    Arr.filter(molecule.atoms, (atom) => atom.element === element).length;
  return { C: count("C"), H: count("H"), O: count("O") };
}

/** The length of every bond of a molecule between two atoms that are not hydrogen. */
function spansOf(molecule: Molecule) {
  return Arr.flatMap(molecule.bonds, (bond) => {
    const from = molecule.atoms[bond.from];
    const to = molecule.atoms[bond.to];
    if (
      from === undefined ||
      to === undefined ||
      from.element === "H" ||
      to.element === "H"
    ) {
      return [];
    }
    return [length(sub(from.at, to.at))];
  });
}

/** The torsion about the bond from `b` to `c`, in degrees. */
function torsionOf(a: Point, b: Point, c: Point, d: Point) {
  const axis = unit(sub(c, b));
  const first = cross(sub(b, a), axis);
  const second = cross(axis, sub(d, c));
  return (
    (Math.atan2(dot(cross(first, second), axis), dot(first, second)) * 180) /
    Math.PI
  );
}

/** The heavy atoms of unit `part` in the order the unit was built. */
function heavyOf(molecule: Molecule, part: number) {
  return Arr.filter(
    molecule.atoms,
    (atom) => atom.part === part && atom.element !== "H"
  );
}

const MALTOSE = [
  {
    anomer: "alpha",
    host: 0,
    oxygen: "O4",
    phi: 80,
    psi: 130,
    unit: "glucose",
  },
] as const;

describe("glycanOf", () => {
  it("builds glucose as C6H12O6 in a chair with every ring bond 1.52 angstrom", () => {
    const glucose = glycanOf({ anomer: "beta", unit: "glucose" }, []);
    expect(formulaOf(glucose.molecule)).toEqual({ C: 6, H: 12, O: 6 });
    expect(glucose.free).toHaveLength(1);
    expect(glucose.bridges).toEqual([]);
    const ring = Arr.take(heavyOf(glucose.molecule, 0), 6);
    Arr.forEach(ring, (atom, index) => {
      const next = ring[(index + 1) % 6];
      expect(length(sub(atom.at, next?.at ?? [0, 0, 0]))).toBeCloseTo(1.52, 9);
      expect(Math.abs(atom.at[2])).toBeCloseTo(0.25, 9);
    });
    expect(length(glucose.centers[0])).toBeCloseTo(0, 9);
  });

  it("stands the alpha anomer's hydroxyl and galactose's fourth hydroxyl axial", () => {
    const drop = (anomer: "alpha" | "beta", kind: "galactose" | "glucose") => {
      const heavy = heavyOf(glycanOf({ anomer, unit: kind }, []).molecule, 0);
      const rise = (carbon: number, oxygen: number) =>
        Math.abs((heavy[oxygen]?.at[2] ?? 0) - (heavy[carbon]?.at[2] ?? 0));
      return { first: rise(0, 6), fourth: rise(3, 9) };
    };
    expect(drop("alpha", "glucose").first).toBeCloseTo(1.43, 9);
    expect(drop("beta", "glucose").first).toBeLessThan(0.5);
    expect(drop("beta", "glucose").fourth).toBeLessThan(0.5);
    expect(drop("beta", "galactose").fourth).toBeCloseTo(1.43, 9);
  });

  it("builds fructose as C6H12O6 on a five-membered ring", () => {
    const fructose = glycanOf({ anomer: "beta", unit: "fructose" }, []);
    expect(formulaOf(fructose.molecule)).toEqual({ C: 6, H: 12, O: 6 });
    const ring = Arr.take(heavyOf(fructose.molecule, 0), 5);
    Arr.forEach(ring, (atom, index) => {
      const span = length(sub(atom.at, ring[(index + 1) % 5]?.at ?? [0, 0, 0]));
      expect(span).toBeGreaterThan(1.4);
      expect(span).toBeLessThan(1.56);
    });
    Arr.forEach(spansOf(fructose.molecule), (span) => {
      expect(span).toBeGreaterThan(1.4);
      expect(span).toBeLessThan(1.56);
    });
    expect(Math.abs(fructose.centers[0][2])).toBeLessThan(0.2);
  });

  it("joins two glucoses into maltose, C12H22O11, at the bond's angle and torsions", () => {
    const maltose = glycanOf({ anomer: "beta", unit: "glucose" }, MALTOSE);
    expect(formulaOf(maltose.molecule)).toEqual({ C: 12, H: 22, O: 11 });
    const host = heavyOf(maltose.molecule, 0);
    const joined = heavyOf(maltose.molecule, 1);
    const [bridge] = maltose.bridges;
    const [c3, c4, o4] = [host[2], host[3], host[9]];
    const [c1, o5] = [joined[0], joined[5]];
    if (
      bridge === undefined ||
      c3 === undefined ||
      c4 === undefined ||
      o4 === undefined ||
      c1 === undefined ||
      o5 === undefined
    ) {
      expect.unreachable("maltose lacks an atom of its glycosidic bond");
      return;
    }
    expect(bridge).toEqual(o4.at);
    expect(length(sub(c1.at, bridge))).toBeCloseTo(1.43, 9);
    expect(
      (Math.acos(dot(unit(sub(c1.at, bridge)), unit(sub(c4.at, bridge)))) *
        180) /
        Math.PI
    ).toBeCloseTo(117, 6);
    expect(torsionOf(o5.at, c1.at, bridge, c4.at)).toBeCloseTo(80, 6);
    expect(torsionOf(c1.at, bridge, c4.at, c3.at)).toBeCloseTo(130, 6);
    Arr.forEach(spansOf(maltose.molecule), (span) => {
      expect(span).toBeGreaterThan(1.42);
      expect(span).toBeLessThan(1.53);
    });
  });

  it("gives back each unit as the whole sugar hydrolysis releases", () => {
    const maltose = glycanOf({ anomer: "beta", unit: "glucose" }, MALTOSE);
    expect(Arr.map(maltose.free, formulaOf)).toEqual([
      { C: 6, H: 12, O: 6 },
      { C: 6, H: 12, O: 6 },
    ]);
    expect(Arr.map(maltose.free, (unitOf) => unitOf.atoms[0]?.part)).toEqual([
      0, 1,
    ]);
    expect(maltose.free[1]?.atoms[0]?.at).toEqual(
      heavyOf(maltose.molecule, 1)[0]?.at
    );
    expect(
      length(sub(maltose.centers[1] ?? [0, 0, 0], maltose.centers[0]))
    ).toBeGreaterThan(4);
  });

  it("leaves a sugar free when its join names a unit that is not there", () => {
    const stray = glycanOf({ anomer: "beta", unit: "glucose" }, [
      { ...MALTOSE[0], host: 5 },
    ]);
    expect(stray.bridges).toEqual([]);
    expect(formulaOf(stray.molecule)).toEqual({ C: 12, H: 24, O: 11 });
    expect(stray.centers).toHaveLength(2);
  });
});
