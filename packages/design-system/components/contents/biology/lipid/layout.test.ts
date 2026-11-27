// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  asideOf,
  crowdMarksOf,
  frameOf,
  MIDDLE,
  marksOf,
  poolsOf,
  standOf,
} from "@repo/design-system/components/contents/biology/lipid/layout";
import {
  bilayerOf,
  dropletOf,
} from "@repo/design-system/components/three/molecule/lipid";
import { Array as Arr, Order } from "effect";

describe("frameOf and standOf", () => {
  it("steps back and moves the subject left in a narrow frame", () => {
    expect(frameOf(true).camera[2]).toBeGreaterThan(frameOf(false).camera[2]);
    expect(frameOf(true).shift).toBeLessThan(0);
    expect(standOf(false)[0]).toBe(frameOf(false).shift);
    expect(asideOf("triglyceride", true)).toBe(0);
    expect(asideOf("phospholipid", true)).toBe(frameOf(true).aside);
    expect(standOf(true)[0]).toBe(frameOf(true).shift);
    expect(standOf(false)[1] - 24.9 * frameOf(false).molecule).toBeCloseTo(
      0.08,
      9
    );
  });
});

describe("marksOf", () => {
  it("names glycerol, the ester bond and the fatty acid of a saturated fat", () => {
    const marks = marksOf("triglyceride", false, false);
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
    expect(glycerol?.at[0]).toBeGreaterThan(standOf(false)[0]);
    expect(ester?.at[0]).toBeLessThan(standOf(false)[0]);
    expect(fatty?.at[1]).toBeLessThan((ester?.at[1] ?? 0) - 0.3);
  });

  it("adds the phosphate group of a membrane lipid and the kink of an unsaturated tail", () => {
    const marks = marksOf("phospholipid", true, false);
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
    const column = marksOf("phospholipid", true, true);
    expect(new Set(Arr.map(column, (mark) => mark.at[0])).size).toBe(1);
    expect(new Set(Arr.map(marks, (mark) => mark.at[0])).size).toBe(5);
    expect(kink?.at[1]).toBeLessThan(glycerol?.at[1] ?? 0);
  });

  it("stands every label on the right of a narrow frame, none on another", () => {
    const marks = marksOf("phospholipid", true, true);
    Arr.forEach(marks, (mark) => {
      expect(mark.side).toBe("right");
    });
    const heights = Arr.sort(
      Arr.map(marks, (mark) => mark.at[1]),
      Order.Number
    );
    Arr.forEach(Arr.zip(heights, Arr.drop(heights, 1)), ([low, high]) => {
      expect(high - low).toBeGreaterThan(0.14);
    });
  });
});

describe("crowdMarksOf and poolsOf", () => {
  it("names the heads and tails of a bilayer on its right and nothing of a droplet", () => {
    const bilayer = bilayerOf(false, 5, 3);
    const marks = crowdMarksOf("phospholipid", bilayer, false);
    expect(Arr.map(marks, (mark) => mark.part)).toEqual(["head", "tail"]);
    const [head, tail] = marks;
    expect(head?.at[1]).toBeGreaterThan(tail?.at[1] ?? 9);
    expect(tail?.at[1]).toBeGreaterThan(MIDDLE);
    expect(head?.at[0]).toBeGreaterThan(0.3);
    expect(crowdMarksOf("phospholipid", bilayer, true)[0]?.at[0]).toBeLessThan(
      head?.at[0] ?? 0
    );
    expect(crowdMarksOf("triglyceride", dropletOf(false), false)).toEqual([]);
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
