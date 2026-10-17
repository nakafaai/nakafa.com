import { describe, expect, it } from "@effect/vitest";
import {
  idlePointer,
  locate,
  measure,
  pointerPush,
} from "@repo/design-system/components/pool/pointer";
import {
  ballAt,
  CHECKED_POOLS,
  FRAME,
  LARGE_POOL_TIMEOUT,
  NOISE,
  poolWorld,
  settle,
  sweep,
} from "@repo/design-system/components/pool/test.fixture";
import { Array as Arr } from "effect";

/** A pointer over the box, at the given place, with no speed yet. */
function overBox(x: number, y: number) {
  return { active: true, seen: { x, y }, vx: 0, vy: 0, x, y };
}

/** A pointer that has just come over the box at this place. */
function enteredAt(x: number, y: number) {
  return { ...locate(idlePointer(), { x, y }), active: true };
}

/** A step of one second, so that a ball takes over the pointer's speed for a full second. */
const UNIT_STEP = 1;
/** The speed of the sweep over the pile, in pixels per second. */
const SWEEP_SPEED = 300;
/**
 * The fastest ball of each checked pool, 585, 823 and 1463 pixels wide, at scale 1,
 * when the pointer sweeps across a settled pile at 300 pixels a second. Before the
 * pool moved more lively these were 62.76, 84.65 and 153.30 pixels a second. Now they
 * are 468, 748 and 449 pixels a second, measured with `sweep` in `test.fixture.ts`.
 */
const BEFORE_SWEEP: readonly number[] = [62.76, 84.65, 153.3];

describe("the push of the pointer", () => {
  it("pushes nothing before the pointer comes over the box", () => {
    expect(pointerPush(idlePointer(), ballAt({ x: 600 }), UNIT_STEP)).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("pushes a ball away from the pointer, with the spring of its reach", () => {
    // The ball is 40 pixels from the pointer, and its reach is 64: (64 - 40) * 160.
    expect(
      pointerPush(overBox(560, 300), ballAt({ x: 600 }), UNIT_STEP)
    ).toEqual({
      vx: 3840,
      vy: 0,
    });
  });

  it("pushes a nearer ball harder than a farther one, so the push falls off with distance", () => {
    const near = pointerPush(
      overBox(590, 300),
      ballAt({ x: 600 }),
      UNIT_STEP
    ).vx;
    const far = pointerPush(
      overBox(560, 300),
      ballAt({ x: 600 }),
      UNIT_STEP
    ).vx;
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it("takes over 24 times the pointer's speed in pixels per second, each second", () => {
    const fast = { ...overBox(560, 300), vx: 500 };
    expect(pointerPush(fast, ballAt({ x: 600 }), UNIT_STEP).vx).toBe(
      3840 + 500 * 24
    );
    // A frame takes over its share of that: 24 times 500 pixels a second, for one frame.
    expect(pointerPush(fast, ballAt({ x: 600 }), FRAME).vx).toBeCloseTo(
      3840 * FRAME + 500 * 24 * FRAME,
      10
    );
  });

  it("takes over no more than 2400 pixels a second of the pointer's speed, which is 40 pixels a frame", () => {
    const faster = { ...overBox(560, 300), vx: 5000 };
    expect(pointerPush(faster, ballAt({ x: 600 }), UNIT_STEP).vx).toBe(
      3840 + 2400 * 24
    );
  });

  it("pushes nothing when the pointer lies exactly on the center of a ball", () => {
    expect(
      pointerPush(overBox(600, 300), ballAt({ x: 600 }), UNIT_STEP)
    ).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("pushes nothing from beyond the reach of a ball", () => {
    expect(
      pointerPush(overBox(500, 300), ballAt({ x: 600 }), UNIT_STEP)
    ).toEqual({
      vx: 0,
      vy: 0,
    });
  });
});

describe("the speed of the pointer", () => {
  it("measures the pointer's speed in pixels per second over the frame", () => {
    const moved = locate(overBox(100, 100), { x: 130, y: 100 });
    expect(measure(moved, 0.05)).toMatchObject({ vx: 600, vy: 0 });
  });

  it("measures the same speed however many moves came in the frame", () => {
    // Two moves of 15 pixels make the same 30 pixels that one move makes, so both are 600 pixels a second.
    const twice = locate(locate(overBox(100, 100), { x: 115, y: 100 }), {
      x: 130,
      y: 100,
    });
    expect(measure(twice, 0.05).vx).toBeCloseTo(600, 9);
  });

  it("gives a pointer that has just come over the box no speed in its first frame", () => {
    expect(measure(enteredAt(300, 200), 0.05)).toMatchObject({ vx: 0, vy: 0 });
  });

  it("gives a pointer that did not move in the frame no speed in it, though it had speed before", () => {
    const still = measure({ ...overBox(130, 100), vx: 300 }, FRAME);
    expect(still).toMatchObject({ vx: 0, vy: 0 });
  });

  it("starts before the box, and not over it", () => {
    expect(idlePointer().active).toBe(false);
  });
});

describe("the pointer over the pile", () => {
  for (const [pool, before] of Arr.zip(CHECKED_POOLS, BEFORE_SWEEP)) {
    it(
      `moves the fastest ball of a ${pool.width} by ${pool.height} pool faster than before when the pointer sweeps at ${SWEEP_SPEED} pixels a second`,
      () => {
        const settled = settle(poolWorld(pool.width, pool.height));
        const [swept, fastest] = sweep(settled, pool, SWEEP_SPEED);
        // The sweep crossed the pool: the pointer ends within one frame of the far wall.
        expect(pool.width - swept.pointer.x).toBeLessThanOrEqual(
          SWEEP_SPEED * FRAME + NOISE
        );
        expect(fastest).toBeGreaterThan(before);
      },
      pool === CHECKED_POOLS[0] ? undefined : LARGE_POOL_TIMEOUT
    );
  }
});
