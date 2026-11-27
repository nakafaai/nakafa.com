// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  crowdOf,
  layoutOf,
  MIDDLE,
  poolsOf,
} from "@repo/design-system/components/contents/biology/lipid/layout";
import { Array as Arr } from "effect";

describe("layoutOf", () => {
  it("hangs the lipid just above the floor, centred, inside its box", () => {
    const { bounds, molecule, scale, stand } = layoutOf("triglyceride", true);
    const lows = Arr.map(molecule.atoms, (atom) => atom.at[1]);
    const sides = Arr.map(molecule.atoms, (atom) => atom.at[0]);
    expect(stand[1] + Math.min(...lows) * scale).toBeCloseTo(0.08, 9);
    expect(
      stand[0] + ((Math.min(...sides) + Math.max(...sides)) / 2) * scale
    ).toBeCloseTo(0, 9);
    expect(bounds.x.min).toBeCloseTo(Math.min(...sides) - 1.2, 9);
    expect(bounds.y.max).toBeCloseTo(Math.max(...lows) + 1.2, 9);
    expect(bounds.z.max).toBeGreaterThan(bounds.z.min + 2.4);
  });

  it("names glycerol, an ester bond and a fatty acid of a saturated fat on its right", () => {
    const { marks, molecule, scale, stand } = layoutOf("triglyceride", false);
    expect(Arr.map(marks, (mark) => mark.part)).toEqual([
      "ester",
      "glycerol",
      "fatty",
    ]);
    const [ester, glycerol, fatty] = marks;
    expect(glycerol?.at[0]).toBeGreaterThan(stand[0]);
    expect(ester?.at[1]).toBeGreaterThan(glycerol?.at[1] ?? 9);
    expect(fatty?.at[1]).toBeLessThan((glycerol?.at[1] ?? 0) - 0.2);
    const right =
      stand[0] +
      Math.max(...Arr.map(molecule.atoms, (atom) => atom.at[0])) * scale;
    Arr.forEach(marks, (mark) => {
      expect(mark.at[0]).toBeLessThan(right + 0.07);
    });
  });

  it("adds the phosphate group of a membrane lipid and the kink of an unsaturated tail", () => {
    const { marks } = layoutOf("phospholipid", true);
    expect(Arr.map(marks, (mark) => mark.part)).toEqual([
      "phosphate",
      "glycerol",
      "ester",
      "kink",
      "fatty",
    ]);
  });

  it("keeps every label clear of the one above", () => {
    Arr.forEach(["phospholipid", "triglyceride"] as const, (kind) => {
      Arr.forEach([true, false], (unsaturated) => {
        const { marks, scale } = layoutOf(kind, unsaturated);
        const heights = Arr.map(marks, (mark) => mark.at[1]);
        Arr.forEach(Arr.zip(heights, Arr.drop(heights, 1)), ([high, low]) => {
          expect(high - low).toBeGreaterThan(3.39 * scale);
        });
      });
    });
  });
});

describe("crowdOf and poolsOf", () => {
  it("names the heads and tails of a bilayer on its right", () => {
    const bilayer = crowdOf("phospholipid", false);
    expect(Arr.map(bilayer.marks, (mark) => mark.part)).toEqual([
      "head",
      "tail",
    ]);
    const [head, tail] = bilayer.marks;
    expect(head?.at[1]).toBeGreaterThan(tail?.at[1] ?? 9);
    expect(tail?.at[1]).toBeGreaterThan(MIDDLE);
    expect(head?.at[0]).toBeGreaterThan(bilayer.bounds.x.max * bilayer.scale);
    expect(bilayer.stand).toEqual([0, MIDDLE, 0]);
    expect(
      Arr.filter(bilayer.molecule.atoms, (atom) => atom.element === "P")
    ).toHaveLength(36);
    expect(
      Arr.filter(
        crowdOf("phospholipid", true).molecule.atoms,
        (atom) => atom.element === "P"
      )
    ).toHaveLength(32);
  });

  it("stands a clump of fat in the middle with no labels", () => {
    const clump = crowdOf("triglyceride", false);
    expect(clump.marks).toEqual([]);
    expect(clump.stand).toEqual([0, MIDDLE, 0]);
    expect(Arr.some(clump.molecule.atoms, (atom) => atom.element === "P")).toBe(
      false
    );
    expect(clump.bounds.y.max).toBeGreaterThan(20);
  });

  it("gathers water above and below a bilayer and all around a clump of fat", () => {
    Arr.forEach(poolsOf("phospholipid"), (pool) => {
      expect(Math.abs(pool[1])).toBeGreaterThan(40);
    });
    expect(
      Arr.some(poolsOf("triglyceride"), (pool) => Math.abs(pool[1]) < 25)
    ).toBe(true);
    expect(poolsOf("triglyceride")).toHaveLength(6);
  });
});
