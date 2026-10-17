import { describe, expect, it } from "@effect/vitest";
import {
  isResting,
  move,
  press,
  REST_FRAMES,
} from "@repo/design-system/components/pool/physics";
import {
  finishSettle,
  isSettled,
  settle,
  settleFor,
  startSettle,
} from "@repo/design-system/components/pool/settle";
import {
  ballAt,
  boxWith,
  CHECKED_POOLS,
  poolWorld,
} from "@repo/design-system/components/pool/test.fixture";
import { Array as Arr } from "effect";

describe("the settle of a pile", () => {
  it("settles to a standstill with no sideways speed and no lean", () => {
    const settled = settle(
      boxWith([
        ballAt({ tilt: 4, vx: 300, vy: 50, x: 500, y: 600 }),
        ballAt({ tilt: -3, vx: -200, vy: 0, x: 700, y: 600 }),
      ])
    );
    expect(Arr.map(settled.balls, (ball) => ball.vx)).toEqual([0, 0]);
    expect(Arr.map(settled.balls, (ball) => ball.tilt)).toEqual([0, 0]);
  });

  it("settles a pile until it has rested, and no longer", () => {
    const start = poolWorld(1200, 640);
    const settling = settleFor(startSettle(start), Number.POSITIVE_INFINITY);
    // The settle stopped because the pile rested, not because it ran out of frames.
    expect(settling.calm).toBeGreaterThanOrEqual(REST_FRAMES);
    // One frame earlier the pile had not yet rested for long enough, so the stop is exact.
    expect(
      settleFor(startSettle(start), settling.frames - 1).calm
    ).toBeLessThan(REST_FRAMES);
  });

  it("settles in parts to the same pile as settling at once, however the parts fall", () => {
    const start = poolWorld(1200, 640);
    const parts = Arr.reduce(
      Arr.makeBy(300, () => 7),
      startSettle(start),
      (current, frames) => settleFor(current, frames)
    );
    expect(isSettled(parts)).toBe(true);
    expect(finishSettle(parts)).toEqual(settle(start));
  });

  it("ignores a pointer and a held ball, so the pile does not depend on where the pointer was", () => {
    const pressed = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    const pointed = move(pressed, { x: 330, y: 300 });
    expect(settle(pointed)).toEqual(
      settle(boxWith([ballAt({ x: 300, y: 300 })]))
    );
  });
});

describe("the pile when it first shows", () => {
  for (const pool of CHECKED_POOLS) {
    it(`shows a ${pool.width} by ${pool.height} pool with every ball inside the box, and at rest`, () => {
      const shown = settle(poolWorld(pool.width, pool.height));
      expect(Arr.every(shown.balls, (ball) => ball.inside)).toBe(true);
      expect(isResting(shown)).toBe(true);
    });
  }
});
