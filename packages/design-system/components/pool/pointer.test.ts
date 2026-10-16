import { describe, expect, it } from "@effect/vitest";
import {
  fadePointer,
  idlePointer,
  locate,
  pointerPush,
} from "@repo/design-system/components/pool/pointer";
import { ballAt } from "@repo/design-system/components/pool/test.fixture";

/** A pointer over the box, at the given place, with no speed yet. */
function overBox(x: number, y: number) {
  return { active: true, vx: 0, vy: 0, x, y };
}

/** A step of one second in a frame of two seconds: the frame's half is then exactly one second. */
const UNIT_STEP = 1;
const UNIT_FRAME = 2;

describe("the push of the pointer", () => {
  it("pushes nothing before the pointer comes over the box", () => {
    expect(
      pointerPush(idlePointer(), ballAt({ x: 600 }), UNIT_STEP, UNIT_FRAME)
    ).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("pushes a ball away from the pointer, with the spring of its reach", () => {
    // The ball is 40 pixels from the pointer, and its reach is 64: (64 - 40) * 110.
    expect(
      pointerPush(overBox(560, 300), ballAt({ x: 600 }), UNIT_STEP, UNIT_FRAME)
    ).toEqual({
      vx: 2640,
      vy: 0,
    });
  });

  it("passes on the pointer's own speed, clamped to 28 pixels per second and halved", () => {
    const fast = { ...overBox(560, 300), vx: 500 };
    expect(
      pointerPush(fast, ballAt({ x: 600 }), UNIT_STEP, UNIT_FRAME).vx
    ).toBe(2640 + 14);
  });

  it("pushes nothing when the pointer lies exactly on the center of a ball", () => {
    expect(
      pointerPush(overBox(600, 300), ballAt({ x: 600 }), UNIT_STEP, UNIT_FRAME)
    ).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("pushes nothing from beyond the reach of a ball", () => {
    expect(
      pointerPush(overBox(500, 300), ballAt({ x: 600 }), UNIT_STEP, UNIT_FRAME)
    ).toEqual({
      vx: 0,
      vy: 0,
    });
  });
});

describe("the place of the pointer", () => {
  it("takes the speed of a move from the place it was at", () => {
    const moved = locate(
      { active: false, vx: 0, vy: 0, x: 0, y: 0 },
      { x: 10, y: 5 }
    );
    expect(moved).toEqual({ active: false, vx: 10, vy: 5, x: 10, y: 5 });
  });

  it("fades its own speed by 0.8 each frame", () => {
    const faded = fadePointer({ ...overBox(0, 0), vx: 100, vy: -50 });
    expect(faded.vx).toBeCloseTo(80, 10);
    expect(faded.vy).toBeCloseTo(-40, 10);
  });

  it("starts before the box, and not over it", () => {
    expect(idlePointer().active).toBe(false);
  });
});
