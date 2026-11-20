// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { DIE } from "@repo/design-system/components/contents/mathematics/dice/faces";
import {
  outcomes,
  probabilityOf,
} from "@repo/design-system/components/contents/mathematics/dice/odds";
import {
  FELT,
  lowestPoint,
  restPose,
  TRAY,
} from "@repo/design-system/components/contents/mathematics/dice/pose";
import {
  hitsOf,
  planRolls,
  posesAt,
  ROLLS,
  rollSeconds,
  runSeconds,
  SLOW_SECONDS,
  settledBy,
  tally,
} from "@repo/design-system/components/contents/mathematics/dice/roll";
import { Array as Arr } from "effect";

/** How far a die reaches sideways from its centre however it is turned: half its body diagonal. */
const REACH = DIE.half * Math.sqrt(3);

const ONE = planRolls(1);
const TWO = planRolls(2);

describe("a run of rolls", () => {
  it("starts slow and speeds up to 25 rolls a second", () => {
    expect(Arr.map(Arr.range(0, 2), rollSeconds)).toEqual([2.2, 2.2, 2.2]);
    expect(rollSeconds(3)).toBeCloseTo(SLOW_SECONDS * 0.7, 12);
    expect(rollSeconds(4)).toBeLessThan(rollSeconds(3));
    expect(rollSeconds(ROLLS - 1)).toBe(0.04);
  });

  it("plays the same rolls for every learner, one after another", () => {
    expect(planRolls(1)).toEqual(ONE);
    expect(ONE).toHaveLength(ROLLS);
    Arr.forEach(Arr.range(1, ROLLS - 1), (index) => {
      const roll = Arr.getUnsafe(ONE, index);
      const before = Arr.getUnsafe(ONE, index - 1);
      expect(roll.start).toBeCloseTo(before.start + before.seconds, 9);
    });
    expect(runSeconds(ONE)).toBeGreaterThan(15);
    expect(runSeconds(ONE)).toBeLessThan(25);
    expect(runSeconds([])).toBe(0);
  });

  it("adds the faces of two dice", () => {
    Arr.forEach(TWO, (roll) => {
      expect(roll.throws).toHaveLength(2);
      expect(roll.outcome).toBe(
        Arr.reduce(roll.throws, 0, (sum, each) => sum + each.face)
      );
    });
    expect(
      Arr.every(ONE, (roll) => roll.outcome >= 1 && roll.outcome <= 6)
    ).toBe(true);
  });

  it("counts a roll once its dice have come to rest", () => {
    expect(settledBy(ONE, 0)).toBe(0);
    expect(settledBy(ONE, 2)).toBe(1);
    expect(settledBy(ONE, runSeconds(ONE))).toBe(ROLLS);
  });

  it("tallies the outcomes, and the frequency settles near the theory", () => {
    const counts = tally(TWO, ROLLS, 2);
    expect(Arr.reduce(counts, 0, (sum, count) => sum + count)).toBe(ROLLS);
    expect(hitsOf(TWO, ROLLS, 7)).toBe(Arr.getUnsafe(counts, 5));
    expect(hitsOf(TWO, 0, 7)).toBe(0);
    Arr.forEach(outcomes(2), (sum, index) => {
      expect(
        Math.abs(Arr.getUnsafe(counts, index) / ROLLS - probabilityOf(2, sum))
      ).toBeLessThan(0.06);
    });
    expect(tally(ONE, 0, 1)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("leaves the dice where the last roll left them, and gathers them from there", () => {
    const last = Arr.getUnsafe(ONE, ROLLS - 1);
    const rest = restPose(Arr.getUnsafe(last.throws, 0));
    expect(posesAt(ONE, runSeconds(ONE) + 1)).toEqual([rest]);
    expect(Arr.getUnsafe(posesAt(ONE, -1), 0).position).toEqual(rest.position);
    expect(Arr.getUnsafe(posesAt(ONE, 0), 0).position).toEqual(rest.position);
  });

  it("keeps the dice inside the tray, on the felt, and apart", () => {
    const end = Arr.getUnsafe(TWO, 40).start;
    Arr.forEach(Arr.range(0, Math.ceil(end * 200)), (step) => {
      const poses = posesAt(TWO, step / 200);
      Arr.forEach(poses, (pose) => {
        expect(Math.abs(pose.position[0]) + REACH).toBeLessThan(
          TRAY.length / 2
        );
        expect(Math.abs(pose.position[2]) + REACH).toBeLessThan(TRAY.width / 2);
        expect(
          pose.position[1] - lowestPoint(pose.turn)
        ).toBeGreaterThanOrEqual(FELT - 1e-12);
      });
      const [first, second] = poses;
      const apart = Math.hypot(
        (first?.position[0] ?? 0) - (second?.position[0] ?? 0),
        (first?.position[2] ?? 0) - (second?.position[2] ?? 0)
      );
      expect(apart).toBeGreaterThan(2 * REACH);
    });
  });
});
