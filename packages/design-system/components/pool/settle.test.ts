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
  SETTLE_FRAMES,
  settleFor,
  startSettle,
} from "@repo/design-system/components/pool/settle";
import {
  ballAt,
  boxWith,
  CHECKED_POOLS,
  poolWorld,
  settle,
} from "@repo/design-system/components/pool/test.fixture";
import { Array as Arr } from "effect";

/** The narrowest checked pool, which is the quickest to settle. */
const NARROW = CHECKED_POOLS[0];

describe("the settle of a pile", () => {
  it("settles to a pile with no sideways speed and no lean, and at rest", () => {
    const settled = settle(
      boxWith([
        ballAt({ tilt: 4, vx: 300, vy: 50, x: 500, y: 600 }),
        ballAt({ tilt: -3, vx: -200, vy: 0, x: 700, y: 600 }),
      ])
    );
    expect(Arr.map(settled.balls, (ball) => ball.vx)).toEqual([0, 0]);
    expect(Arr.map(settled.balls, (ball) => ball.tilt)).toEqual([0, 0]);
    expect(isResting(settled)).toBe(true);
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

  it("settles in parts of any length to the same pile as settling at once", () => {
    const start = poolWorld(NARROW.width, NARROW.height);
    for (const part of [1, 8, 64]) {
      let settling = startSettle(start);
      while (!isSettled(settling)) {
        settling = settleFor(settling, part);
      }
      expect(finishSettle(settling)).toEqual(settle(start));
    }
  });

  it("ends a settle that has run its frames, even when the pile has not rested", () => {
    const moving = boxWith([ballAt({ vy: 400, y: 300 })]);
    expect(isSettled({ ...startSettle(moving), frames: SETTLE_FRAMES })).toBe(
      true
    );
  });

  it("keeps a settle going while its pile has neither rested nor run all its frames", () => {
    const moving = boxWith([ballAt({ vy: 400, y: 300 })]);
    expect(
      isSettled({ ...startSettle(moving), frames: SETTLE_FRAMES - 1 })
    ).toBe(false);
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
