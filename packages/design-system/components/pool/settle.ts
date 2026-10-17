import {
  isResting,
  REST_FRAMES,
  tick,
  type World,
  WorldSchema,
} from "@repo/design-system/components/pool/physics";
import { idlePointer } from "@repo/design-system/components/pool/pointer";
import { Array as Arr, Schema } from "effect";

/**
 * Settling: the pool moves a frame at a time until its pile rests, so that the
 * pile is already at rest when it first shows. A settle runs in parts, so that a
 * long settle never blocks the page in one piece.
 */

/** The length of a settle's frame, in seconds: a frame at 60 frames a second. */
const SETTLE_FRAME = 1 / 60;
/** The most frames that a settle runs, so that a pile which never rests still ends: 30 seconds at 60 frames a second. */
export const SETTLE_FRAMES = 60 * 30;

/**
 * A settle that runs in parts: the pool, the frames it has run, and the calm frames
 * in a row at its end. A settle has no pointer and no held ball.
 */
const SettlingSchema = Schema.Struct({
  calm: Schema.Int,
  frames: Schema.Int,
  world: WorldSchema,
});

/** A settle that runs in parts. */
export type Settling = typeof SettlingSchema.Type;

/**
 * A settle that has not run a frame yet. A settle has no pointer and no held ball, so
 * the pile it leaves does not depend on where the pointer was.
 */
export function startSettle(world: World): Settling {
  return {
    calm: 0,
    frames: 0,
    world: { ...world, held: null, pointer: idlePointer() },
  };
}

/**
 * Whether a settle is over: the pile has rested for `REST_FRAMES` frames in a row, or
 * the settle has run its `SETTLE_FRAMES`.
 */
export function isSettled(settling: Settling): boolean {
  return settling.calm >= REST_FRAMES || settling.frames >= SETTLE_FRAMES;
}

/**
 * Runs up to `frames` frames of a settle, and stops early once it is over. A settle
 * run in parts stops on the same frame, and leaves the same pile, as one run at once.
 */
export function settleFor(settling: Settling, frames: number): Settling {
  let current = settling;
  for (let index = 0; index < frames && !isSettled(current); index += 1) {
    const walked = tick(current.world, SETTLE_FRAME);
    current = {
      calm: isResting(walked) ? current.calm + 1 : 0,
      frames: current.frames + 1,
      world: walked,
    };
  }
  return current;
}

/**
 * The pile of a finished settle, with no sideways speed and no lean, so that the pile
 * stands still on its first paint.
 */
export function finishSettle(settling: Settling): World {
  return {
    ...settling.world,
    balls: Arr.map(settling.world.balls, (ball) => ({
      ...ball,
      tilt: 0,
      vx: 0,
    })),
  };
}
