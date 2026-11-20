// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { expectedCounts } from "@repo/design-system/components/contents/mathematics/galton/binomial";
import type { BoardPoint } from "@repo/design-system/components/contents/mathematics/galton/board";
import {
  BALL_RADIUS,
  binCentre,
  contactPoint,
  dividerTop,
  hopperPoints,
  PIN_RADIUS,
  PITCH,
  pinPoints,
  ROW_GAP,
} from "@repo/design-system/components/contents/mathematics/galton/board";
import {
  BALLS,
  ballAt,
  HOP,
  landedBy,
  planRun,
  releasedBy,
  releaseTimes,
  runEnd,
  SLOW_GRAVITY,
} from "@repo/design-system/components/contents/mathematics/galton/run";
import { Array as Arr, Option } from "effect";

/** Where a ball is, failing the test if it has not left the hopper. */
function pointOf(option: Option.Option<BoardPoint>) {
  return Option.getOrThrow(option);
}

/** How many planned balls rest in each bin, 0 to `rows`. */
function binCounts(run: ReturnType<typeof planRun>, rows: number) {
  return Arr.makeBy(
    rows + 1,
    (bin) => Arr.filter(run, (plan) => plan.bin === bin).length
  );
}

describe("a run of the Galton board", () => {
  it("lets the balls go slowly at first, then half a hop apart", () => {
    const times = releaseTimes(BALLS);
    expect(times).toHaveLength(BALLS);
    expect(Arr.getUnsafe(times, 1) - Arr.getUnsafe(times, 0)).toBeCloseTo(
      1.3,
      12
    );
    expect(
      Arr.getUnsafe(times, BALLS - 1) - Arr.getUnsafe(times, BALLS - 2)
    ).toBeCloseTo(HOP / 2, 12);
    expect(
      Arr.every(
        Arr.range(1, BALLS - 1),
        (i) => Arr.getUnsafe(times, i) > Arr.getUnsafe(times, i - 1)
      )
    ).toBe(true);
  });

  it("gives the same run every time and sends each ball to the bin of its rights", () => {
    const run = planRun(8, 0.5);
    expect(planRun(8, 0.5)).toEqual(run);
    for (const plan of run) {
      expect(plan.rights).toHaveLength(8);
      expect(plan.bin).toBe(Arr.filter(plan.rights, Boolean).length);
      expect(plan.land).toBeGreaterThan(plan.release);
    }
  });

  it("fills the bins near the binomial counts and never past their dividers", () => {
    for (const rows of Arr.range(4, 12)) {
      for (const p of [0.3, 0.5, 0.7]) {
        const run = planRun(rows, p);
        const counts = binCounts(run, rows);
        const expected = expectedCounts(rows, p, BALLS);
        expect(Arr.reduce(counts, 0, (a, b) => a + b)).toBe(BALLS);
        Arr.forEach(counts, (count, bin) => {
          const spread = Math.sqrt(
            BALLS *
              (Arr.getUnsafe(expected, bin) / BALLS) *
              (1 - Arr.getUnsafe(expected, bin) / BALLS)
          );
          expect(
            Math.abs(count - Arr.getUnsafe(expected, bin))
          ).toBeLessThanOrEqual(4 * spread + 1);
        });
        const highest = Arr.reduce(run, 0, (top, plan) =>
          Math.max(top, plan.rest.y)
        );
        expect(highest + BALL_RADIUS).toBeLessThan(dividerTop(rows));
      }
    }
  });

  it("biases the bounces with p", () => {
    const mean = (p: number) =>
      Arr.reduce(planRun(10, p), 0, (sum, plan) => sum + plan.bin) / BALLS;
    expect(mean(0.3)).toBeLessThan(mean(0.5));
    expect(mean(0.5)).toBeLessThan(mean(0.7));
  });

  it("follows a ball from the hopper over every pin into its bin", () => {
    const rows = 6;
    const run = planRun(rows, 0.5);
    const plan = Arr.getUnsafe(run, 0);
    expect(Option.isNone(ballAt(plan, rows, plan.release - 0.01))).toBe(true);
    expect(pointOf(ballAt(plan, rows, plan.release))).toEqual(
      hopperPoints(1)[0]
    );
    const firstPin = pointOf(
      ballAt(
        plan,
        rows,
        plan.release +
          1e-9 +
          Math.sqrt(
            (2 * (Arr.getUnsafe(hopperPoints(1), 0).y - contactPoint(0, 0).y)) /
              SLOW_GRAVITY
          )
      )
    );
    expect(firstPin.x).toBeCloseTo(0, 6);
    expect(firstPin.y).toBeCloseTo(contactPoint(0, 0).y, 5);
    expect(pointOf(ballAt(plan, rows, plan.land))).toEqual(plan.rest);
    expect(pointOf(ballAt(plan, rows, plan.land + 5))).toEqual(plan.rest);
    const pins = pinPoints(rows);
    for (const step of Arr.range(0, 400)) {
      const time = plan.release + ((plan.land - plan.release) * step) / 400;
      const point = pointOf(ballAt(plan, rows, time));
      for (const pin of pins) {
        expect(
          Math.hypot(point.x - pin.x, point.y - pin.y)
        ).toBeGreaterThanOrEqual(PIN_RADIUS + BALL_RADIUS - 1e-6);
      }
    }
    const lastHop = plan.land - 1e-6;
    const near = pointOf(ballAt(plan, rows, lastHop));
    expect(near.x).toBeCloseTo(plan.rest.x, 3);
    expect(Math.abs(near.x - binCentre(rows, plan.bin))).toBeLessThan(
      PITCH / 2
    );
  });

  it("hops half a pitch across and one row down from pin to pin", () => {
    const rows = 5;
    const plan = Arr.getUnsafe(planRun(rows, 0.5), 3);
    const start =
      plan.release +
      Math.sqrt(
        (2 * (Arr.getUnsafe(hopperPoints(1), 0).y - contactPoint(0, 0).y)) /
          SLOW_GRAVITY
      );
    const second = pointOf(ballAt(plan, rows, start + HOP));
    expect(second.y).toBeCloseTo(contactPoint(1, 0).y, 9);
    expect(second.x).toBeCloseTo(plan.rights[0] ? PITCH / 2 : -PITCH / 2, 9);
    expect(contactPoint(0, 0).y - contactPoint(1, 0).y).toBeCloseTo(
      ROW_GAP,
      12
    );
  });

  it("counts the balls let go and landed, and ends when the last one rests", () => {
    const run = planRun(8, 0.7);
    const end = runEnd(run);
    expect(releasedBy(run, -1)).toBe(0);
    expect(landedBy(run, -1)).toBe(0);
    expect(releasedBy(run, end)).toBe(BALLS);
    expect(landedBy(run, end)).toBe(BALLS);
    expect(landedBy(run, end - 0.001)).toBeLessThan(BALLS);
    expect(releasedBy(run, 5)).toBeGreaterThan(landedBy(run, 5));
  });
});
