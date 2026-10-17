import type { Ball } from "@repo/design-system/components/pool/ball";
import { Number as Num, Schema } from "effect";

/**
 * The pointer of the pool: where it is over the box, how fast it moves, and what
 * it pushes. Every function takes the pointer and returns the next one.
 */

/** How far beyond its radius a ball feels the pointer, in pixels. */
const POINTER_REACH = 44;
/**
 * How hard the pointer pushes a ball, per pixel that the ball is inside its reach.
 * Measured on the three checked pools, 585, 823 and 1463 pixels wide, with the
 * pointer swept across 0.6 of the height from a settled pile at 300 pixels a second:
 * the fastest ball reached 63, 85 and 158 pixels a second, where 80 gave 272, 206
 * and 297.
 */
const POINTER_PUSH = 40;
/**
 * The most of the pointer's speed that a ball takes over, in pixels per second.
 * This is 28 pixels a frame at 60 frames a second.
 */
const POINTER_SPEED_LIMIT = 1680;
/** Where the pointer waits before it has come near the box, in pixels. */
const NOWHERE = -9999;

/** A place in the box, in pixels from its top left corner. */
export const PointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** A place in the box. */
export type Point = typeof PointSchema.Type;

/**
 * The pointer: where it is, whether it is over the box, and its speed in pixels per
 * second over the last frame. `seen` is where the pointer was when that frame began.
 */
export const PointerSchema = Schema.Struct({
  active: Schema.Boolean,
  seen: PointSchema,
  vx: Schema.Finite,
  vy: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

/** The pointer of the pool. */
type Pointer = typeof PointerSchema.Type;

/** The pointer before it has come near the box. */
export function idlePointer(): Pointer {
  return {
    active: false,
    seen: { x: NOWHERE, y: NOWHERE },
    vx: 0,
    vy: 0,
    x: NOWHERE,
    y: NOWHERE,
  };
}

/**
 * The pointer at `point`. A pointer that was not over the box starts from this
 * place, so that its first frame has no speed.
 */
export function locate(pointer: Pointer, point: Point): Pointer {
  return {
    ...pointer,
    seen: pointer.active ? pointer.seen : point,
    x: point.x,
    y: point.y,
  };
}

/**
 * The speed of the pointer over a frame that lasted `seconds`, in pixels per second,
 * from where it was when the frame began. Speed comes from the time that passed, not
 * from the number of pointer events in the frame, so every frame measures the whole
 * move at once.
 */
export function measure(pointer: Pointer, seconds: number): Pointer {
  const moving = pointer.active && seconds > 0;
  return {
    ...pointer,
    seen: { x: pointer.x, y: pointer.y },
    vx: moving ? (pointer.x - pointer.seen.x) / seconds : 0,
    vy: moving ? (pointer.y - pointer.seen.y) / seconds : 0,
  };
}

/**
 * The change of velocity that the pointer gives a free ball in one step of `dt`
 * seconds. Only a pointer over the box, and near the ball, gives any. The spring
 * acts over the step, and the ball takes over the pointer's speed in proportion to the
 * step: a second of steps takes over all of it.
 */
export function pointerPush(pointer: Pointer, ball: Ball, dt: number) {
  if (!pointer.active) {
    return { vx: 0, vy: 0 };
  }
  const dx = ball.x - pointer.x;
  const dy = ball.y - pointer.y;
  const reach = ball.r + POINTER_REACH;
  const near = dx * dx + dy * dy;
  if (near >= reach * reach || near === 0) {
    return { vx: 0, vy: 0 };
  }
  const distance = Math.sqrt(near);
  // A soft spring: the nearer the pointer, the firmer the push.
  const push = (reach - distance) * POINTER_PUSH;
  const limit = {
    maximum: POINTER_SPEED_LIMIT,
    minimum: -POINTER_SPEED_LIMIT,
  };
  return {
    vx: (dx / distance) * push * dt + Num.clamp(pointer.vx, limit) * dt,
    vy: (dy / distance) * push * dt + Num.clamp(pointer.vy, limit) * dt,
  };
}
