import { Number as Num, Schema } from "effect";

/**
 * One ball of the pool and what belongs to one ball alone: how fast it may go,
 * how it bounces off the box, and how it leans as it moves. Most functions take
 * a ball and return the next one. `fastest` takes velocities, and `tiltOf` returns
 * a lean.
 */

/** The top speed, in pixels per second, of anything that is not held. */
export const FASTEST = 1400;
/** The share of speed that a ball keeps when a left or right wall turns it back. */
const SIDE_BOUNCE = 0.6;
/** The share of speed that a ball keeps when the floor turns it back. */
const FLOOR_BOUNCE = 0.45;
/** The share of sideways speed that a ball keeps when the floor turns it back. */
const FLOOR_FRICTION = 0.9;
/** A floor bounce slower than this, in pixels per second, stops the ball. */
const FLOOR_STOP = 26;
/** The share of speed that a ball keeps when the top wall turns it back, once it has been inside. */
const CEILING_BOUNCE = 0.5;
/** The lean of a ball per pixel per second of sideways speed, in degrees. */
const LEAN_PER_SPEED = 0.03;
/** The most that a ball leans, in degrees, either way. */
const LEAN_LIMIT = 10;
/** The share of the way that a lean moves toward its target each frame. */
const LEAN_EASE = 0.2;
/** The share of a lean that stays when the pile is at rest. */
const LEAN_REST = 0.6;

/** A ball: its radius, its center, its speed, its lean, and whether it has entered the box. */
export const BallSchema = Schema.Struct({
  inside: Schema.Boolean,
  r: Schema.Finite,
  tilt: Schema.Finite,
  vx: Schema.Finite,
  vy: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

/** One ball of the pool. */
export type Ball = typeof BallSchema.Type;

/**
 * Keeps a velocity inside the top speed. A fast velocity keeps its direction and
 * loses only its speed.
 */
export function fastest(vx: number, vy: number) {
  const speed = Math.hypot(vx, vy);
  if (speed <= FASTEST) {
    return { vx, vy };
  }
  return { vx: (vx * FASTEST) / speed, vy: (vy * FASTEST) / speed };
}

/**
 * The ball with its speed kept inside the top speed. A collision can push a free
 * ball past the top speed, and this takes the extra speed back.
 */
export function limitSpeed(ball: Ball): Ball {
  const speed = fastest(ball.vx, ball.vy);
  return { ...ball, vx: speed.vx, vy: speed.vy };
}

/**
 * The walls of the box. A ball bounces off the left and right walls and the
 * floor. It meets the top wall only once it has been inside, so a ball that falls
 * in from above is not turned back at the top edge.
 */
export function fence(ball: Ball, width: number, height: number): Ball {
  let { x, y, vx, vy } = ball;
  let { inside } = ball;
  if (x < ball.r) {
    x = ball.r;
    if (vx < 0) {
      vx = -vx * SIDE_BOUNCE;
    }
  }
  if (x > width - ball.r) {
    x = width - ball.r;
    if (vx > 0) {
      vx = -vx * SIDE_BOUNCE;
    }
  }
  if (y > height - ball.r) {
    y = height - ball.r;
    if (vy > 0) {
      vy = -vy * FLOOR_BOUNCE;
      vx *= FLOOR_FRICTION;
      if (Math.abs(vy) < FLOOR_STOP) {
        vy = 0;
      }
    }
  }
  if (!inside && y >= ball.r) {
    inside = true;
  }
  if (inside && y < ball.r) {
    y = ball.r;
    if (vy < 0) {
      vy = -vy * CEILING_BOUNCE;
    }
  }
  return { ...ball, inside, vx, vy, x, y };
}

/**
 * The lean of a ball, in degrees. It follows the sideways speed a little, eases
 * toward it, and comes back upright when the pile is at rest.
 */
export function tiltOf(ball: Ball, resting: boolean): number {
  const lean = Num.clamp(ball.vx * LEAN_PER_SPEED, {
    maximum: LEAN_LIMIT,
    minimum: -LEAN_LIMIT,
  });
  const eased = ball.tilt + (lean - ball.tilt) * LEAN_EASE;
  return resting ? eased * LEAN_REST : eased;
}
