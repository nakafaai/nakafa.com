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
/** The distance that two balls on the very same point are treated as apart, in pixels. */
const SAME_POINT_DISTANCE = 0.01;

/**
 * Pushes every pair of balls apart and gives back the speed of their collisions,
 * over two passes. The held ball is never moved by the others.
 */
export function pushApart(balls: readonly Ball[], held: number | null): Ball[] {
  const working = Arr.map(balls, (ball) => ball);
  for (let pass = 0; pass < PASSES; pass += 1) {
    for (let first = 0; first < working.length; first += 1) {
      for (let second = first + 1; second < working.length; second += 1) {
        const [a, b] = collidePair(
          working[first],
          working[second],
          first === held,
          second === held
        );
        working[first] = a;
        working[second] = b;
      }
    }
  }
  return working;
}

/** Pushes two balls apart if they overlap, and turns them back if they approach. */
function collidePair(
  first: Ball,
  second: Ball,
  firstHeld: boolean,
  secondHeld: boolean
): readonly [Ball, Ball] {
  const reach = first.r + second.r;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const near = dx * dx + dy * dy;
  if (near >= reach * reach) {
    return [first, second];
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
  const pushedFirst = firstHeld
    ? first
    : { ...first, x: first.x - shiftX, y: first.y - shiftY };
  const pushedSecond = secondHeld
    ? second
    : { ...second, x: second.x + shiftX, y: second.y + shiftY };
  const relative = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
  if (relative >= 0) {
    return [pushedFirst, pushedSecond];
  }
  const impulse = relative * IMPULSE;
  return [
    {
      ...pushedFirst,
      vx: first.vx + nx * impulse,
      vy: first.vy + ny * impulse,
    },
    {
      ...pushedSecond,
      vx: second.vx - nx * impulse,
      vy: second.vy - ny * impulse,
    },
  ];
}
