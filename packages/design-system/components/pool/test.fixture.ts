import type { Ball } from "@repo/design-system/components/pool/ball";
import {
  ARTWORK_SHARE,
  coverOf,
} from "@repo/design-system/components/pool/cover";
import {
  poolMembers,
  poolStarts,
} from "@repo/design-system/components/pool/member";
import {
  move,
  tick,
  type World,
} from "@repo/design-system/components/pool/physics";
import { createWorld } from "@repo/design-system/components/pool/place";
import {
  finishSettle,
  settleFor,
  startSettle,
} from "@repo/design-system/components/pool/settle";
import { Array as Arr } from "effect";

/** One ball inside the box of the tests, unless the test says otherwise. */
export function ballAt(overrides: Partial<Ball>): Ball {
  return {
    inside: true,
    r: 20,
    tilt: 0,
    vx: 0,
    vy: 0,
    x: 600,
    y: 300,
    ...overrides,
  };
}

/** A pool in a 1200 by 640 box, with these balls and nothing else. */
export function boxWith(balls: readonly Ball[]): World {
  return { ...createWorld(1200, 640, []), balls };
}

/** The pool as it starts in a box of this size: its animals, sized for the box, all above it. */
export function poolWorld(width: number, height: number): World {
  return createWorld(width, height, poolStarts(coverOf(width, height)));
}

/**
 * The checked pools: the sign-in column beside the form on screens 1024, 1440 and
 * 2560 wide, in whole pixels as the browser reports it. The pool never renders below
 * the lg breakpoint, 1024 pixels wide, so no smaller box is checked.
 */
export const CHECKED_POOLS = [
  { height: 640, width: Math.round(1024 * ARTWORK_SHARE) },
  { height: 900, width: Math.round(1440 * ARTWORK_SHARE) },
  { height: 1440, width: Math.round(2560 * ARTWORK_SHARE) },
];

/**
 * The per-test timeout of a test over one of the two larger checked pools, in
 * milliseconds. A settle, a sweep or a rough hand over those pools takes longer than the
 * default five seconds under load, so their tests pass this as a test option. The
 * narrowest pool keeps the default.
 */
export const LARGE_POOL_TIMEOUT = 20_000;

/** A frame of the pool at 60 frames a second. */
export const FRAME = 1 / 60;
/** Float noise that a wall may leave behind, in pixels or pixels per second. */
export const NOISE = 1e-9;

/** The pool moved a frame at a time until its pile is settled, with no pointer: the pile it rests in, finished. */
export function settle(world: World): World {
  return finishSettle(settleFor(startSettle(world), Number.POSITIVE_INFINITY));
}

/**
 * The radius that each ball of a pool of this size has at scale 1, in the order of its
 * balls. A pool of this size grows its animals above that radius, so a ball's size
 * ratio is its radius over this one.
 */
function baseRadiiOf(box: Pick<World, "height" | "width">): readonly number[] {
  return Arr.map(
    poolMembers(coverOf(box.width, box.height).animals),
    (member) => member.radius
  );
}

/**
 * The fastest that any ball of a world moves, in pixels per second at scale 1: its
 * speed divided by its size ratio, its radius over its base radius. An animal's ratio
 * is the pool's scale, and a thing keeps its radius, so its ratio is one.
 */
function fastestAtScaleOne(world: World, bases: readonly number[]): number {
  return Arr.reduce(Arr.zip(world.balls, bases), 0, (fastest, [ball, base]) =>
    Math.max(fastest, Math.hypot(ball.vx, ball.vy) / (ball.r / base))
  );
}

/**
 * Sweeps the pointer across the middle of a settled pool at this speed, in pixels per
 * second. Returns the pool at the end of the sweep, and the fastest ball at scale 1.
 */
export function sweep(
  world: World,
  box: Pick<World, "height" | "width">,
  speed: number
): readonly [World, number] {
  const distance = box.width;
  const frames = Math.ceil(distance / (speed * FRAME));
  const y = box.height * 0.6;
  const bases = baseRadiiOf(box);
  let current = world;
  let fastest = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const x = Math.min(distance, frame * speed * FRAME);
    current = tick(move(current, { x, y }), FRAME);
    fastest = Math.max(fastest, fastestAtScaleOne(current, bases));
  }
  return [current, fastest];
}
