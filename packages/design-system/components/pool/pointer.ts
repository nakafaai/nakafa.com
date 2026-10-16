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
 * Measured with sweeps at 300 to 1200 pixels a second over a settled pile of 63 to
 * 65 animals: at 80 the fastest ball reached 196 pixels a second at most.
 */
const POINTER_PUSH = 80;
/** The pointer's own speed that a ball takes over, in pixels per second, before it is clamped. */
const POINTER_SPEED_LIMIT = 28;
/** The share of the pointer's own speed that a ball takes over in each half frame. */
const POINTER_SHARE = 0.5;
/** The share of the pointer's speed that stays after each frame. */
const POINTER_FADE = 0.8;
/** Where the pointer waits before it has come near the box, in pixels. */
const NOWHERE = -9999;

/** A place in the box, in pixels from its top left corner. */
export const PointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** A place in the box. */
export type Point = typeof PointSchema.Type;

/** The pointer: where it is, how fast it moves, and whether it is over the box. */
export const PointerSchema = Schema.Struct({
  active: Schema.Boolean,
  vx: Schema.Finite,
  vy: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

/** The pointer of the pool. */
type Pointer = typeof PointerSchema.Type;

/** The pointer before it has come near the box. */
export function idlePointer(): Pointer {
  return { active: false, vx: 0, vy: 0, x: NOWHERE, y: NOWHERE };
}

/** The pointer at `point`, with the speed it has since its last place. */
export function locate(pointer: Pointer, point: Point): Pointer {
  return {
    active: pointer.active,
    vx: point.x - pointer.x,
    vy: point.y - pointer.y,
    x: point.x,
    y: point.y,
  };
}

/**
 * The change of velocity that the pointer gives a free ball in one step of `dt`
 * seconds, in a frame that lasted `frame` seconds. Only a pointer over the box,
 * and near the ball, gives any. The spring acts over the step. The pointer's own
 * speed is passed on per half frame, so a frame passes on the same share at any
 * refresh rate.
 */
export function pointerPush(
  pointer: Pointer,
  ball: Ball,
  dt: number,
  frame: number
) {
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
  // The share of a half frame that this step covers.
  const share = (dt * 2) / frame;
  const limit = {
    maximum: POINTER_SPEED_LIMIT,
    minimum: -POINTER_SPEED_LIMIT,
  };
  return {
    vx:
      (dx / distance) * push * dt +
      Num.clamp(pointer.vx, limit) * POINTER_SHARE * share,
    vy:
      (dy / distance) * push * dt +
      Num.clamp(pointer.vy, limit) * POINTER_SHARE * share,
  };
}

/** The pointer's own speed fades a little each frame. */
export function fadePointer(pointer: Pointer): Pointer {
  return {
    ...pointer,
    vx: pointer.vx * POINTER_FADE,
    vy: pointer.vy * POINTER_FADE,
  };
}
