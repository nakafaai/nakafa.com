import { describe, expect, it } from "@effect/vitest";
import {
  idlePointer,
  locate,
  measure,
  pointerPush,
} from "@repo/design-system/components/pool/pointer";
import { ballAt } from "@repo/design-system/components/pool/test.fixture";

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
/** A frame at 60 frames a second. */
const FRAME = 1 / 60;

describe("the push of the pointer", () => {
  it("pushes nothing before the pointer comes over the box", () => {
    expect(pointerPush(idlePointer(), ballAt({ x: 600 }), UNIT_STEP)).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("pushes a ball away from the pointer, with the spring of its reach", () => {
    // The ball is 40 pixels from the pointer, and its reach is 64: (64 - 40) * 80.
    expect(
      pointerPush(overBox(560, 300), ballAt({ x: 600 }), UNIT_STEP)
    ).toEqual({
      vx: 1920,
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
    expect(pointerPush(fast, ballAt({ x: 600 }), UNIT_STEP).vx).toBe(
      1920 + 500
    );
    // A frame takes over its share of the speed: 500 pixels a second for one frame.
    expect(pointerPush(fast, ballAt({ x: 600 }), FRAME).vx).toBeCloseTo(
      1920 * FRAME + 500 * FRAME,
      10
    );
  });

  it("takes over no more than 1680 pixels a second, which is 28 pixels a frame", () => {
    const faster = { ...overBox(560, 300), vx: 5000 };
    expect(pointerPush(faster, ballAt({ x: 600 }), UNIT_STEP).vx).toBe(
      1920 + 1680
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

  it("gives a pointer that did not move in the frame no speed in it", () => {
    const still = measure(overBox(130, 100), FRAME);
    expect(still).toMatchObject({ vx: 0, vy: 0 });
  });

  it("starts before the box, and not over it", () => {
    expect(idlePointer().active).toBe(false);
  });
});
