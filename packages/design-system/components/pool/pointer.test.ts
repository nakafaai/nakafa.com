import { describe, expect, it } from "@effect/vitest";
import { FASTEST } from "@repo/design-system/components/pool/ball";
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
  NOISE,
  poolWorld,
  settle,
  sweep,
} from "@repo/design-system/components/pool/test.fixture";

/** A pointer over the box, at the given place, with no speed yet. */
function overBox(x: number, y: number) {
  return { active: true, seen: { x, y }, vx: 0, vy: 0, x, y };
}

/** A pointer that has just come over the box at this place. */
function enteredAt(x: number, y: number) {
  return { ...locate(idlePointer(), { x, y }), active: true };
}

/** A step of one second, so that a ball takes over the pointer's speed one for one. */
const UNIT_STEP = 1;
/**
 * The fastest a ball may move while the pointer sweeps over the pool, in pixels per
 * second at scale 1: a third of the top speed. Every checked pool is held to it.
 * Speed is measured against the size of the animal, so a ball's speed is divided by
 * its size ratio, its radius over the radius it has at scale 1.
 */
const GENTLE_SPEED = FASTEST / 3;

describe("the push of the pointer", () => {
  it("pushes nothing before the pointer comes over the box", () => {
    expect(pointerPush(idlePointer(), ballAt({ x: 600 }), UNIT_STEP)).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("pushes a ball away from the pointer, with the spring of its reach", () => {
    // The ball is 40 pixels from the pointer, and its reach is 64: (64 - 40) * 40.
    expect(
      pointerPush(overBox(560, 300), ballAt({ x: 600 }), UNIT_STEP)
    ).toEqual({
      vx: 960,
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

  it("takes over the pointer's speed in pixels per second, one for one per second", () => {
    const fast = { ...overBox(560, 300), vx: 500 };
    expect(pointerPush(fast, ballAt({ x: 600 }), UNIT_STEP).vx).toBe(960 + 500);
    // A frame takes over its share of the speed: 500 pixels a second for one frame.
    expect(pointerPush(fast, ballAt({ x: 600 }), FRAME).vx).toBeCloseTo(
      960 * FRAME + 500 * FRAME,
      10
    );
  });

  it("takes over no more than 1680 pixels a second, which is 28 pixels a frame", () => {
    const faster = { ...overBox(560, 300), vx: 5000 };
    expect(pointerPush(faster, ballAt({ x: 600 }), UNIT_STEP).vx).toBe(
      960 + 1680
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
  for (const speed of [300, 1200]) {
    for (const pool of CHECKED_POOLS) {
      it(`keeps every ball within a third of the top speed at its own size in a ${pool.width} by ${pool.height} pool when the pointer sweeps at ${speed} pixels a second`, () => {
        const settled = settle(poolWorld(pool.width, pool.height));
        const [swept, fastest] = sweep(settled, pool, speed);
        // The sweep crossed the pool: the pointer ends within one frame of the far wall.
        expect(pool.width - swept.pointer.x).toBeLessThanOrEqual(
          speed * FRAME + NOISE
        );
        expect(fastest).toBeLessThanOrEqual(GENTLE_SPEED);
      });
    }
  }
});
