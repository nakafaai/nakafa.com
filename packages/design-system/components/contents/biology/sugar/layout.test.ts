import { describe, expect, it } from "@effect/vitest";
import {
  chainLayout,
  GAP,
  MIDDLE,
  pairLayout,
  stageOf,
} from "@repo/design-system/components/contents/biology/sugar/layout";
import {
  POLYSACCHARIDES,
  SUGARS,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import { Array as Arr } from "effect";

describe("stageOf", () => {
  it("closes the gap, bonds at the half, then lets the water drift away", () => {
    expect(stageOf(0)).toEqual({ apart: 1, bonded: false, drift: 0 });
    expect(stageOf(0.25).apart).toBeCloseTo(0.5, 9);
    expect(stageOf(0.25).bonded).toBe(false);
    expect(stageOf(0.5)).toEqual({ apart: 0, bonded: true, drift: 0 });
    expect(stageOf(0.75).drift).toBeCloseTo(0.5, 9);
    expect(stageOf(1)).toEqual({ apart: 0, bonded: true, drift: 1 });
  });
});

describe("pairLayout", () => {
  it("lays every disaccharide along x inside the box the camera frames", () => {
    Arr.forEach(SUGARS, (sugar) => {
      const layout = pairLayout(sugar);
      const middle = (part: number) => {
        const places = Arr.map(
          Arr.filter(layout.molecule.atoms, (atom) => atom.part === part),
          (atom) => atom.at[0]
        );
        return Arr.reduce(places, 0, (sum, x) => sum + x) / places.length;
      };
      expect(Math.abs(middle(0))).toBeGreaterThan(1.5);
      expect(Math.sign(middle(0))).toBe(-Math.sign(middle(1)));
      Arr.forEach(layout.molecule.atoms, (atom) => {
        expect(atom.at[0] - GAP / 2).toBeGreaterThan(layout.bounds.x.min);
        expect(atom.at[0] + GAP / 2).toBeLessThan(layout.bounds.x.max);
        expect(atom.at[1]).toBeGreaterThan(layout.bounds.y.min);
        expect(atom.at[1]).toBeLessThan(layout.bounds.y.max);
      });
      expect(layout.rest[1]).toBeGreaterThan(layout.bounds.y.min);
      expect(layout.first.atoms).toHaveLength(24);
      expect(layout.second.atoms).toHaveLength(24);
      expect(layout.stand).toEqual([0, MIDDLE, 0]);
    });
  });

  it("names each sugar just under its own ring and the bond just over its oxygen", () => {
    Arr.forEach(SUGARS, (sugar) => {
      const { bounds, bridge, first, marks, molecule, second, size } =
        pairLayout(sugar);
      const height = (y: number) => MIDDLE + y * size;
      const lowest = (atoms: typeof first.atoms) =>
        Math.min(...Arr.map(atoms, (atom) => atom.at[1]));
      expect(marks.first[0]).toBeLessThan(-0.15);
      expect(marks.second[0]).toBeGreaterThan(0.15);
      expect(marks.first[1]).toBeCloseTo(height(lowest(first.atoms) - 0.6), 9);
      expect(marks.second[1]).toBeCloseTo(
        height(lowest(second.atoms) - 0.6),
        9
      );
      const over = Arr.filter(
        molecule.atoms,
        (atom) => Math.abs(atom.at[0] - bridge[0]) < 2.4
      );
      Arr.forEach(over, (atom) => {
        expect(marks.bond[1]).toBeGreaterThan(height(atom.at[1]));
      });
      expect(marks.bond[1]).toBeGreaterThan(height(bridge[1]));
      expect(marks.bond[1]).toBeLessThan(height(bridge[1] + 4.5));
      expect(size * (bounds.x.max - bounds.x.min)).toBeCloseTo(1.7, 9);
    });
  });
});

describe("chainLayout", () => {
  it("frames every atom of every polysaccharide and names its first bond above it", () => {
    Arr.forEach(POLYSACCHARIDES, (polysaccharide) => {
      Arr.forEach([2, 7, 12], (units) => {
        const layout = chainLayout(polysaccharide, units);
        Arr.forEach(layout.molecule.atoms, (atom) => {
          expect(atom.at[0]).toBeGreaterThan(layout.bounds.x.min);
          expect(atom.at[0]).toBeLessThan(layout.bounds.x.max);
          expect(atom.at[1]).toBeGreaterThan(layout.bounds.y.min);
          expect(atom.at[1]).toBeLessThan(layout.bounds.y.max);
        });
        const tops = Arr.map(layout.molecule.atoms, (atom) => atom.at[1]);
        expect(layout.mark[1]).toBeLessThan(
          layout.stand[1] + (Math.max(...tops) + 0.61) * layout.size
        );
        expect(
          layout.size * (layout.bounds.x.max - layout.bounds.x.min)
        ).toBeLessThan(1.71);
      });
    });
  });

  it("draws cellulose with the neighbouring chain and its hydrogen bonds, the others alone", () => {
    const cellulose = chainLayout("cellulose", 6);
    const starch = chainLayout("starch", 6);
    expect(cellulose.beside).toBe(6);
    expect(cellulose.molecule.atoms).toHaveLength(
      starch.molecule.atoms.length * 2
    );
    expect(cellulose.molecule.ties.length).toBeGreaterThan(5);
    expect(
      Math.max(
        ...Arr.flatMap(cellulose.molecule.bonds, (bond) => [bond.from, bond.to])
      )
    ).toBe(cellulose.molecule.atoms.length - 1);
    expect(starch.beside).toBe(Number.POSITIVE_INFINITY);
    expect(starch.molecule.ties).toEqual([]);
  });
});
