import type { Ball } from "@repo/design-system/components/pool/ball";
import { Array as Arr } from "effect";

/**
 * The collisions of the pool: balls that overlap are pushed apart, and balls that
 * approach each other give back the speed of the approach.
 */

/** The most that two balls are pushed apart in one pass, in pixels. */
const PUSH_LIMIT = 6;
/** Passes over every pair of balls in one step. */
const PASSES = 2;
/** The share of an approach speed that a collision gives back to each ball. */
const IMPULSE = 0.62;
/**
 * The most sliding that a contact stops, as a share of the push that presses two balls
 * together. Measured on the three checked pools, 585, 823 and 1463 pixels wide: with
 * no friction the pointer sweep at 300 pixels a second reached 319 pixels a second at
 * 585, and with 0.1 it reached 63, 85 and 158. Friction slows the settle: a fresh pool
 * rests after 194, 298 and 528 frames with 0.1, and after 268, 296 and 436 with none.
 * Over six seconds after a settle, 0, 23 and 75 frames move a ball faster than 24
 * pixels a second with 0.1, against 41, 0 and 0 with none.
 */
const FRICTION = 0.1;
/** The distance that two balls on the very same point are treated as apart, in pixels. */
const SAME_POINT_DISTANCE = 0.01;

/** A copy of a ball that `pushApart` changes in place while it works. */
type WorkingBall = { -readonly [Key in keyof Ball]: Ball[Key] };

/**
 * Pushes every pair of balls apart and gives back the speed of their collisions,
 * over two passes. The held ball is never moved by the others. The balls are
 * copied first, so the balls that come in stay as they were.
 */
export function pushApart(balls: readonly Ball[], held: number | null): Ball[] {
  const working: WorkingBall[] = Arr.map(balls, (ball) => ({ ...ball }));
  for (let pass = 0; pass < PASSES; pass += 1) {
    for (let first = 0; first < working.length; first += 1) {
      for (let second = first + 1; second < working.length; second += 1) {
        collidePair(
          working[first],
          working[second],
          first === held,
          second === held
        );
      }
    }
  }
  return working;
}

/**
 * Pushes two balls apart if they overlap, and turns them back if they approach. The
 * two balls are copies that `pushApart` owns, so they change in place, and a pair
 * that lies apart is left alone.
 */
function collidePair(
  first: WorkingBall,
  second: WorkingBall,
  firstHeld: boolean,
  secondHeld: boolean
) {
  const reach = first.r + second.r;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const near = dx * dx + dy * dy;
  if (near >= reach * reach) {
    return;
  }
  // Two balls on the very same point are pushed apart sideways.
  const samePoint = near === 0;
  const distance = samePoint ? SAME_POINT_DISTANCE : Math.sqrt(near);
  const nx = samePoint ? 1 : dx / distance;
  const ny = samePoint ? 0 : dy / distance;
  // Two balls that lie deep in each other part over a few steps, not in one jump.
  const overlap = Math.min(PUSH_LIMIT, (reach - distance) / 2);
  const shiftX = nx * overlap;
  const shiftY = ny * overlap;
  if (!firstHeld) {
    first.x -= shiftX;
    first.y -= shiftY;
  }
  if (!secondHeld) {
    second.x += shiftX;
    second.y += shiftY;
  }
  const relative = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
  if (relative >= 0) {
    return;
  }
  const impulse = relative * IMPULSE;
  first.vx += nx * impulse;
  first.vy += ny * impulse;
  second.vx -= nx * impulse;
  second.vy -= ny * impulse;
  // Friction: the balls stop sliding over each other, up to a share of the push that pressed them.
  const tx = -ny;
  const ty = nx;
  const slide = (second.vx - first.vx) * tx + (second.vy - first.vy) * ty;
  const grip = FRICTION * Math.abs(impulse);
  const friction = Math.max(-grip, Math.min(grip, slide / 2));
  first.vx += tx * friction;
  first.vy += ty * friction;
  second.vx -= tx * friction;
  second.vy -= ty * friction;
}
