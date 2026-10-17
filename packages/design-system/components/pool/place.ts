import type { Ball } from "@repo/design-system/components/pool/ball";
import type { World } from "@repo/design-system/components/pool/physics";
import { idlePointer } from "@repo/design-system/components/pool/pointer";
import { Array as Arr, Schema } from "effect";

/**
 * Where the balls of the pool start, and how the balls of a pool change when its
 * box changes size. A start says where a ball waits above the box.
 */

/** How far above the box a ball may start, in box heights. */
const DROP_SPAN = 1.2;

/** Where a ball starts: its radius, its place as fractions of the box, and its first sideways speed. */
const StartSchema = Schema.Struct({
  fx: Schema.Finite,
  fy: Schema.Finite,
  r: Schema.Finite,
  vx: Schema.Finite,
});

/** How one ball starts. */
export type Start = typeof StartSchema.Type;

/** A ball that waits above the box, spread across its width by the fractions of its start. */
function startBall(start: Start, width: number, height: number): Ball {
  return {
    inside: false,
    r: start.r,
    tilt: 0,
    vx: start.vx,
    vy: 0,
    x: start.r + start.fx * Math.max(1, width - start.r * 2),
    y: -start.r - start.fy * height * DROP_SPAN,
  };
}

/** The pool before anything moves: every ball waits above the box, spread across it. */
export function createWorld(
  width: number,
  height: number,
  starts: readonly Start[]
): World {
  return {
    balls: Arr.map(starts, (start) => startBall(start, width, height)),
    carry: 0,
    grip: { x: 0, y: 0 },
    height,
    held: null,
    moved: 0,
    pointer: idlePointer(),
    width,
  };
}

/**
 * Makes the balls match these starts, in their order, without restarting the balls
 * that stay. A ball that stays keeps its place, speed and lean, and takes the
 * radius of its start. A new ball waits above the box. The balls past the last
 * start are dropped, and a held ball that is dropped lets go.
 */
export function fit(world: World, starts: readonly Start[]): World {
  const balls = Arr.map(starts, (start, index) =>
    index < world.balls.length
      ? { ...Arr.getUnsafe(world.balls, index), r: start.r }
      : startBall(start, world.width, world.height)
  );
  return {
    ...world,
    balls,
    held: world.held !== null && world.held < balls.length ? world.held : null,
  };
}
