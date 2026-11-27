// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  crowdOf,
  frameOf,
  layoutOf,
  MIDDLE,
  poolsOf,
} from "@repo/design-system/components/contents/biology/lipid/layout";
import { Array as Arr, Order } from "effect";

describe("frameOf", () => {
  it("steps back in a narrow frame and moves a labelled crowd farther aside", () => {
    expect(frameOf(true).camera[2]).toBeGreaterThan(frameOf(false).camera[2]);
    expect(frameOf(true).aside).toBeLessThan(frameOf(false).aside);
  });
});

describe("layoutOf", () => {
  it("hangs the lipid just above the floor at the frame's scale", () => {
    const wide = layoutOf("triglyceride", false, false);
    const lows = Arr.map(wide.molecule.atoms, (atom) => atom.at[1]);
    expect(wide.scale).toBe(frameOf(false).molecule);
    expect(wide.stand[1] + Math.min(...lows) * wide.scale).toBeCloseTo(0.08, 9);
    const narrow = layoutOf("triglyceride", true, true);
    const sides = Arr.map(narrow.molecule.atoms, (atom) => atom.at[0]);
    expect(narrow.stand[0] + Math.min(...sides) * narrow.scale).toBeCloseTo(
      -1.06,
      9
    );
    expect(narrow.stand[0]).toBeLessThan(wide.stand[0]);
  });

  it("names glycerol, the ester bond and the fatty acid of a saturated fat", () => {
    const { marks, stand } = layoutOf("triglyceride", false, false);
    expect(Arr.map(marks, (mark) => mark.part)).toEqual([
      "glycerol",
      "ester",
      "fatty",
    ]);
    expect(Arr.map(marks, (mark) => mark.side)).toEqual([
      "right",
      "left",
      "left",
    ]);
    const [glycerol, ester, fatty] = marks;
    expect(glycerol?.at[0]).toBeGreaterThan(stand[0]);
    expect(ester?.at[0]).toBeLessThan(stand[0]);
    expect(fatty?.at[1]).toBeLessThan((ester?.at[1] ?? 0) - 0.3);
  });

  it("adds the phosphate group of a membrane lipid and the kink of an unsaturated tail", () => {
    const { marks } = layoutOf("phospholipid", true, false);
    expect(Arr.map(marks, (mark) => mark.part)).toEqual([
      "glycerol",
      "ester",
      "fatty",
      "phosphate",
      "kink",
    ]);
    const [glycerol, , , phosphate, kink] = marks;
    expect(phosphate?.at[1]).toBeGreaterThan(glycerol?.at[1] ?? 9);
    expect(kink?.side).toBe("right");
    expect(kink?.at[1]).toBeLessThan(glycerol?.at[1] ?? 0);
    expect(Arr.dedupe(Arr.map(marks, (mark) => mark.at[0]))).toHaveLength(5);
  });

  it("stands every label in one column on the right of a narrow frame, none on another", () => {
    Arr.forEach(["phospholipid", "triglyceride"] as const, (kind) => {
      const { marks } = layoutOf(kind, true, true);
      Arr.forEach(marks, (mark) => {
        expect(mark.side).toBe("right");
      });
      expect(Arr.dedupe(Arr.map(marks, (mark) => mark.at[0]))).toHaveLength(1);
      const heights = Arr.sort(
        Arr.map(marks, (mark) => mark.at[1]),
        Order.Number
      );
      Arr.forEach(Arr.zip(heights, Arr.drop(heights, 1)), ([low, high]) => {
        expect(high - low).toBeGreaterThan(0.15);
      });
    });
  });
});

describe("crowdOf and poolsOf", () => {
  it("names the heads and tails of a bilayer on its right and moves it aside", () => {
    const bilayer = crowdOf("phospholipid", false, false);
    expect(Arr.map(bilayer.marks, (mark) => mark.part)).toEqual([
      "head",
      "tail",
    ]);
    const [head, tail] = bilayer.marks;
    expect(head?.at[1]).toBeGreaterThan(tail?.at[1] ?? 9);
    expect(tail?.at[1]).toBeGreaterThan(MIDDLE);
    expect(head?.at[0]).toBeGreaterThan(0.2);
    expect(bilayer.stand).toEqual([frameOf(false).aside, MIDDLE, 0]);
    expect(bilayer.scale).toBe(frameOf(false).crowd);
    const narrow = crowdOf("phospholipid", true, true);
    expect(narrow.stand[0]).toBe(frameOf(true).aside);
    expect(narrow.marks[0]?.at[0]).toBeLessThan(head?.at[0] ?? 0);
    expect(
      Arr.filter(narrow.molecule.atoms, (atom) => atom.element === "P")
    ).toHaveLength(32);
    expect(
      Arr.filter(bilayer.molecule.atoms, (atom) => atom.element === "P")
    ).toHaveLength(36);
  });

  it("stands a droplet of fat in the middle with no labels", () => {
    const droplet = crowdOf("triglyceride", false, true);
    expect(droplet.marks).toEqual([]);
    expect(droplet.stand).toEqual([0, MIDDLE, 0]);
    expect(
      Arr.some(droplet.molecule.atoms, (atom) => atom.element === "P")
    ).toBe(false);
    expect(crowdOf("triglyceride", true, false).scale).toBe(
      frameOf(false).crowd
    );
  });

  it("gathers water above and below a bilayer and all around a droplet", () => {
    Arr.forEach(poolsOf("phospholipid"), (pool) => {
      expect(Math.abs(pool[1])).toBeGreaterThan(40);
    });
    expect(
      Arr.some(poolsOf("triglyceride"), (pool) => Math.abs(pool[1]) < 25)
    ).toBe(true);
    expect(poolsOf("triglyceride")).toHaveLength(6);
  });
});
