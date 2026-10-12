import {
  type Bounds,
  fence,
  lean,
  type Point,
  PointSchema,
  type Toy,
  ToySchema,
} from "@repo/design-system/lib/toy/flight";
import { Number as Num, type Option, Schema } from "effect";

/** One reading of the pointer: where it is in the window, and when, in milliseconds. */
const SampleSchema = Schema.Struct({
  t: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

/** One reading of the pointer. */
type Sample = typeof SampleSchema.Type;

/**
 * A toy in a hand: the toy, where the hand took it, where it started, and the
 * last reading of the pointer. A hand that has not moved far enough has not
 * dragged yet, so a press stays a click.
 */
const HoldSchema = Schema.Struct({
  dragged: Schema.Boolean,
  offset: PointSchema,
  origin: PointSchema,
  point: PointSchema,
  time: Schema.Finite,
  toy: ToySchema,
});

/** A toy in a hand. */
export type Hold = typeof HoldSchema.Type;

/** The pointer must travel this far, in pixels, before a press becomes a drag. */
const SLOP = 5;
/** A hand that waited longer than this, in milliseconds, before letting go does not throw. */
const REST_AFTER = 80;
/** The fastest a toy is thrown, in pixels per second, on each axis. */
const THROW_LIMIT = 2200;
/** A hand takes this much of the lean a speed asks for, at once. */
const LEAN_IN_HAND = 0.3;
/** Within this many pixels of the top or bottom of the window a held toy pulls the page along. */
const EDGE = 84;
/** The fastest the page is pulled, in pixels per second. */
const PULL = 900;

/**
 * Takes a toy in a hand. The hand keeps the point it took the toy by, in page
 * coordinates, so the toy follows from there and never jumps under the pointer.
 */
export function grab(toy: Toy, pointer: Sample, scroll: Point): Hold {
  return {
    dragged: false,
    offset: {
      x: pointer.x + scroll.x - toy.x,
      y: pointer.y + scroll.y - toy.y,
    },
    origin: { x: pointer.x, y: pointer.y },
    point: { x: pointer.x, y: pointer.y },
    time: pointer.t,
    toy: { ...toy, mode: "held", vx: 0, vy: 0 },
  };
}

/**
 * Puts the toy under the pointer, wherever the page has scrolled to, and
 * keeps it inside its walls.
 */
export function follow(
  hold: Hold,
  scroll: Point,
  bounds: Option.Option<Bounds>
): Hold {
  return {
    ...hold,
    toy: fence(
      {
        ...hold.toy,
        x: hold.point.x + scroll.x - hold.offset.x,
        y: hold.point.y + scroll.y - hold.offset.y,
      },
      bounds
    ),
  };
}

/**
 * Moves a hand. Until the pointer has travelled `SLOP` pixels nothing moves.
 * After that the toy follows it, and the speed of the last stretch is kept for
 * the throw.
 */
export function drag(
  hold: Hold,
  pointer: Sample,
  scroll: Point,
  bounds: Option.Option<Bounds>
): Hold {
  const travelled =
    Math.abs(pointer.x - hold.origin.x) + Math.abs(pointer.y - hold.origin.y);
  if (!hold.dragged && travelled < SLOP) {
    return hold;
  }
  const seconds = Math.max(1, pointer.t - hold.time) / 1000;
  const vx = (pointer.x - hold.point.x) / seconds;
  const vy = (pointer.y - hold.point.y) / seconds;
  return follow(
    {
      ...hold,
      dragged: true,
      point: { x: pointer.x, y: pointer.y },
      time: pointer.t,
      toy: {
        ...hold.toy,
        tilt: hold.toy.tilt + (lean(vx) - hold.toy.tilt) * LEAN_IN_HAND,
        vx,
        vy,
      },
    },
    scroll,
    bounds
  );
}

/**
 * Lets go of a toy. It is thrown at the speed of the hand, up to a limit. A
 * hand that waited before letting go, a press that never moved, and a person
 * who asked for less motion throw nothing.
 */
export function release(hold: Hold, now: number, calm: boolean): Toy {
  const { toy } = hold;
  if (calm || !hold.dragged) {
    return { ...toy, mode: "free", tilt: 0, vx: 0, vy: 0 };
  }
  const rested = now - hold.time > REST_AFTER;
  const limit = { maximum: THROW_LIMIT, minimum: -THROW_LIMIT };
  return {
    ...toy,
    mode: "free",
    vx: rested ? 0 : Num.clamp(toy.vx, limit),
    vy: rested ? 0 : Num.clamp(toy.vy, limit),
  };
}

/**
 * How far the page is pulled in `dt` seconds by a toy held near the top or
 * bottom edge of a window `height` pixels tall: up near the top, down near
 * the bottom, faster the nearer the edge, and not at all in the middle.
 */
export function carry(hold: Hold, height: number, dt: number) {
  if (!hold.dragged) {
    return 0;
  }
  const { y } = hold.point;
  const over = y < EDGE ? y - EDGE : Math.max(0, y - (height - EDGE));
  return Num.clamp(over / EDGE, { maximum: 1, minimum: -1 }) * PULL * dt;
}
