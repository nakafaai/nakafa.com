// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  incrementFrame,
  incrementPlan,
  planDuration,
  pointOnPath,
} from "@repo/design-system/components/contents/mathematics/abacus/motion";
import {
  digitsOf,
  nextValue,
} from "@repo/design-system/components/contents/mathematics/abacus/place";
import {
  BEAD,
  CLEAR,
  POT,
  STACK_SPEED,
  SUNK,
  slotY,
  spikeX,
  TIP,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";
import { Array as Arr } from "effect";

/** The kind, place and count of every move of a plan. */
function shapeOf(value: number, base: number) {
  return Arr.map(incrementPlan(value, base), (move) => [
    move.kind,
    move.place,
    move.count,
  ]);
}

describe("adding one on the abacus", () => {
  it("drops one bead on the units spike when no spike is full", () => {
    expect(shapeOf(6, 10)).toEqual([["drop", 0, 6]]);
  });

  it("lifts every full spike and drops a bead on the next one, each move after the last", () => {
    expect(shapeOf(7, 2)).toEqual([
      ["drop", 0, 1],
      ["lift", 0, 2],
      ["drop", 1, 1],
      ["lift", 1, 2],
      ["drop", 2, 1],
      ["lift", 2, 2],
      ["drop", 3, 0],
    ]);
    const plan = incrementPlan(7, 2);
    Arr.forEach(Arr.drop(plan, 1), (move, index) => {
      const before = plan[index];
      expect(move.start).toBeCloseTo(
        (before?.start ?? 0) + (before?.duration ?? 0),
        10
      );
    });
  });

  it("empties every spike after the largest number, with no bead left to drop", () => {
    expect(Arr.map(incrementPlan(15, 2), (move) => move.kind)).toEqual([
      "drop",
      "lift",
      "drop",
      "lift",
      "drop",
      "lift",
      "drop",
      "lift",
    ]);
    const end = incrementFrame(15, 2, planDuration(incrementPlan(15, 2)));
    expect(end.resting).toEqual([0, 0, 0, 0]);
    expect(end.moving).toEqual([]);
  });

  it("shows the number it started from at the start, and the next number at the end", () => {
    Arr.forEach(
      [
        [6, 10],
        [7, 2],
        [99, 10],
        [24, 5],
        [511, 8],
      ] as const,
      ([value, base]) => {
        expect(incrementFrame(value, base, 0).resting).toEqual(
          digitsOf(value, base)
        );
        expect(
          incrementFrame(value, base, planDuration(incrementPlan(value, base)))
            .resting
        ).toEqual(digitsOf(nextValue(value, base), base));
      }
    );
  });

  it("brings a dropped bead out of the pot, just over the tips and down to its slot", () => {
    const [drop] = incrementPlan(3, 10);
    const legs = drop?.legs ?? [];
    expect(pointOnPath(legs, 0)).toEqual([POT.x, SUNK]);
    const [x, y] = pointOnPath(legs, drop?.duration ?? 0);
    expect(x).toBeCloseTo(spikeX(0), 10);
    expect(y).toBeCloseTo(slotY(3), 10);
    expect(pointOnPath(legs, legs[0]?.duration ?? 0)[1]).toBeCloseTo(CLEAR, 10);
    expect(CLEAR - BEAD.height / 2).toBeGreaterThan(TIP);
  });

  it("keeps a spike's beads until a dropped bead lands, and holds that bead in the air meanwhile", () => {
    const halfway = incrementFrame(3, 10, 0.5);
    expect(halfway.resting).toEqual([3, 0, 0, 0]);
    expect(halfway.moving).toHaveLength(1);
    expect(halfway.moving[0]?.place).toBe(0);
  });

  it("slides a full stack up its spike and flies its beads to the pot from the tip, never touching", () => {
    const [, lift] = incrementPlan(9, 10);
    const start = lift?.start ?? 0;
    const sliding = incrementFrame(9, 10, start + 0.1);
    expect(sliding.resting).toEqual([0, 0, 0, 0]);
    expect(sliding.moving).toHaveLength(10);
    expect(sliding.moving[0]?.y).toBeCloseTo(slotY(0) + STACK_SPEED * 0.1, 10);

    const samples = Math.ceil((lift?.duration ?? 0) / 0.01);
    Arr.forEach(
      Arr.makeBy(samples, (step) => start + step * 0.01),
      (time) => {
        const beads = incrementFrame(9, 10, time).moving;
        Arr.forEach(beads, (bead, index) => {
          Arr.forEach(Arr.drop(beads, index + 1), (other) => {
            const apart =
              Math.abs(bead.x - other.x) >= 2 * BEAD.radius ||
              Math.abs(bead.y - other.y) >= BEAD.height;
            expect(apart).toBe(true);
          });
        });
      }
    );

    const late = incrementFrame(9, 10, start + (lift?.duration ?? 0) - 0.01);
    expect(late.moving.length).toBeLessThan(10);
  });

  it("stands at a path's start before it begins, and shows nothing before a move", () => {
    expect(pointOnPath([], 1)).toEqual([0, 0]);
    const [drop] = incrementPlan(0, 2);
    expect(pointOnPath(drop?.legs ?? [], -1)).toEqual([POT.x, SUNK]);
    expect(incrementFrame(0, 2, -1).moving).toEqual([]);
  });
});
