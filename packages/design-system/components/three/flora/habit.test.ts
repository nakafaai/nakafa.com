import { describe, expect, it } from "@effect/vitest";
import {
  growHabit,
  HABITS,
  LEAF_STRIDE,
  stageHabit,
} from "@repo/design-system/components/three/flora/habit";
import { Array as Arr } from "effect";

/** The leaves of a plant as one record each. */
function leavesOf(leaves: readonly number[]) {
  return Arr.map(Arr.chunksOf(leaves, LEAF_STRIDE), (leaf) => ({
    face: [Number(leaf[6]), Number(leaf[7]), Number(leaf[8])] as const,
    heading: [Number(leaf[3]), Number(leaf[4]), Number(leaf[5])] as const,
    place: [Number(leaf[0]), Number(leaf[1]), Number(leaf[2])] as const,
    size: Number(leaf[9]),
    tone: Number(leaf[10]),
  }));
}

describe("growHabit", () => {
  it("forks a tree through every order of branching and leafs only its last shoots", () => {
    const tree = growHabit(HABITS.broadleaf, 1);

    expect(tree.limbs).toHaveLength(1 + 5 + 25 + 125);
    expect(tree.leaves).toHaveLength(
      125 * HABITS.broadleaf.leaves * LEAF_STRIDE
    );
  });

  it("thins every branch below the limb it leaves", () => {
    const tree = growHabit(HABITS.broadleaf, 1);

    expect(tree.limbs[0]?.base).toBe(HABITS.broadleaf.girth);
    for (const limb of Arr.drop(tree.limbs, 1)) {
      expect(limb.base).toBeLessThan(HABITS.broadleaf.girth);
      expect(limb.tip).toBeLessThan(limb.base);
    }
  });

  it("grows the same plant from the same seed and another from another", () => {
    expect(growHabit(HABITS.sapling, 4)).toEqual(growHabit(HABITS.sapling, 4));
    expect(growHabit(HABITS.sapling, 4).leaves).not.toEqual(
      growHabit(HABITS.sapling, 5).leaves
    );
  });

  it("grows a herb as one stem that bears every leaf itself and ends at its tip", () => {
    const herb = growHabit(HABITS.herb, 3);

    expect(herb.limbs).toHaveLength(1);
    expect(herb.leaves).toHaveLength(HABITS.herb.leaves * LEAF_STRIDE);
    expect(herb.tip[1]).toBeGreaterThan(HABITS.herb.height * 0.8);
    expect(herb.tip[1]).toBeLessThanOrEqual(HABITS.herb.height);
  });

  it("points every leaf along a direction of length 1 with its face square to it", () => {
    for (const leaf of leavesOf(growHabit(HABITS.herb, 3).leaves)) {
      expect(Math.hypot(...leaf.heading)).toBeCloseTo(1);
      expect(Math.hypot(...leaf.face)).toBeCloseTo(1);
      expect(
        leaf.heading[0] * leaf.face[0] +
          leaf.heading[1] * leaf.face[1] +
          leaf.heading[2] * leaf.face[2]
      ).toBeCloseTo(0);
      expect(leaf.size).toBeGreaterThan(0);
    }
  });
});

describe("stageHabit", () => {
  it("leaves a full-grown plant as its habit names it", () => {
    expect(stageHabit(HABITS.herb, 1)).toEqual(HABITS.herb);
    expect(stageHabit(HABITS.herb, 3)).toEqual(HABITS.herb);
  });

  it("draws a seedling short and thin with a first pair of small leaves", () => {
    const seedling = stageHabit(HABITS.herb, 0);

    expect(seedling.height).toBeCloseTo(HABITS.herb.height * 0.03);
    expect(seedling.girth).toBeLessThan(HABITS.herb.girth / 2);
    expect(seedling.leaf).toBeLessThan(HABITS.herb.leaf);
    expect(seedling.leaves).toBe(2);
  });

  it("keeps a biennial low as a rosette while an annual of the same age has risen", () => {
    const rosette = stageHabit(HABITS.biennial, 0.5);
    const annual = stageHabit(HABITS.herb, 0.5);

    expect(rosette.height / HABITS.biennial.height).toBeLessThan(
      annual.height / HABITS.herb.height / 2
    );
    expect(rosette.leaves).toBeGreaterThan(8);
  });
});
