import { Number as Num, Option, Schema } from "effect";

/** A point in pixels. */
export const PointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** A point in pixels. */
export type Point = typeof PointSchema.Type;

/**
 * A toy, measured from the place it lies at in the page: its offset in pixels,
 * its speed in pixels per second and its lean in degrees. In a hand it follows
 * the pointer, going home it springs back, and otherwise it flies and comes to
 * rest.
 */
export const ToySchema = Schema.Struct({
  mode: Schema.Literals(["free", "held", "home"]),
  tilt: Schema.Finite,
  vx: Schema.Finite,
  vy: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

/** The state of one toy. */
export type Toy = typeof ToySchema.Type;

/** How far a toy's offset may go before it meets the walls of its parent. */
const BoundsSchema = Schema.Struct({
  maxX: Schema.Finite,
  maxY: Schema.Finite,
  minX: Schema.Finite,
  minY: Schema.Finite,
});

/** The walls a toy stays inside, as offsets from its place. */
export type Bounds = typeof BoundsSchema.Type;

/** A toy at rest where it lies. */
export const REST: Toy = { mode: "free", tilt: 0, vx: 0, vy: 0, x: 0, y: 0 };

/** How much of its speed a toy keeps when it meets a wall. */
const BOUNCE = 0.45;
/** How fast a flying toy slows down, per second. */
const FRICTION = 3.4;
/** The spring that brings a toy home, and how much it is damped. */
const SPRING = 60;
const DAMPING = 12;
/** A toy leans with its speed, up to this many degrees, and settles toward the lean. */
const LEAN_LIMIT = 14;
const LEAN_PER_SPEED = 0.02;
const LEAN_IN_FLIGHT = 0.18;
/** A toy slower than this, leaning less than this, and nearer home than this has stopped. */
const STOPPED_SPEED = 6;
const STOPPED_LEAN = 0.2;
const STOPPED_DISTANCE = 0.5;
/** A frame is never longer than this, in seconds, whatever the page did meanwhile. */
const LONGEST_FRAME = 0.032;

/** The lean a toy settles toward at a speed. */
export function lean(vx: number) {
  return Num.clamp(vx * LEAN_PER_SPEED, {
    maximum: LEAN_LIMIT,
    minimum: -LEAN_LIMIT,
  });
}

/**
 * Keeps one coordinate between two walls. At a wall the toy turns back and
 * keeps part of its speed. Both walls apply in turn, as a toy larger than its
 * parent meets one and then the other.
 */
function wall(position: number, speed: number, min: number, max: number) {
  const low =
    position < min
      ? { position: min, speed: Math.abs(speed) * BOUNCE }
      : { position, speed };
  return low.position > max
    ? { position: max, speed: -Math.abs(low.speed) * BOUNCE }
    : low;
}

/**
 * Keeps a toy inside its walls. A toy whose parent cannot be measured, because
 * it is hidden or not in the page, goes where it is sent.
 */
export function fence(toy: Toy, bounds: Option.Option<Bounds>): Toy {
  return Option.match(bounds, {
    onNone: () => toy,
    onSome: ({ maxX, maxY, minX, minY }) => {
      const across = wall(toy.x, toy.vx, minX, maxX);
      const down = wall(toy.y, toy.vy, minY, maxY);
      return {
        ...toy,
        vx: across.speed,
        vy: down.speed,
        x: across.position,
        y: down.position,
      };
    },
  });
}

/** Sends a toy back to its place on a soft spring, or at once for a person who asked for less motion. */
export function homeward(toy: Toy, calm: boolean): Toy {
  return calm ? REST : { ...toy, mode: "home" };
}

/** Whether a toy still needs frames: it is in a hand, going home, or still sliding or leaning. */
export function isMoving(toy: Toy) {
  return toy.mode !== "free" || toy.vx !== 0 || toy.vy !== 0 || toy.tilt !== 0;
}

/**
 * How long the frame at `now` lasted since `last`, in seconds. It is never
 * longer than `LONGEST_FRAME`, and never less than nothing: a frame whose time
 * is before the moment the loop woke up, as a frame that began just before a
 * hand let go is, takes a step of zero.
 */
export function frameSeconds(now: number, last: number) {
  return Num.clamp((now - last) / 1000, {
    maximum: LONGEST_FRAME,
    minimum: 0,
  });
}

/**
 * Moves a toy that is not in a hand through one frame of `dt` seconds. A
 * flying toy slows down and bounces off its walls. A toy going home follows a
 * damped spring. Both lean with their speed, and a toy that has stopped is
 * exactly at rest, so no frame is spent on it.
 */
export function step(toy: Toy, dt: number, bounds: Option.Option<Bounds>): Toy {
  if (toy.mode === "held") {
    return toy;
  }
  const homing = toy.mode === "home";
  const slow = Math.exp(-FRICTION * dt);
  const vx = homing
    ? toy.vx + (-SPRING * toy.x - DAMPING * toy.vx) * dt
    : toy.vx * slow;
  const vy = homing
    ? toy.vy + (-SPRING * toy.y - DAMPING * toy.vy) * dt
    : toy.vy * slow;
  const moved = { ...toy, vx, vy, x: toy.x + vx * dt, y: toy.y + vy * dt };
  const kept = homing ? moved : fence(moved, bounds);
  const tilt = kept.tilt + (lean(kept.vx) - kept.tilt) * LEAN_IN_FLIGHT;
  const moving =
    Math.abs(kept.vx) + Math.abs(kept.vy) > STOPPED_SPEED ||
    Math.abs(tilt) > STOPPED_LEAN ||
    (homing && Math.abs(kept.x) + Math.abs(kept.y) > STOPPED_DISTANCE);
  if (moving) {
    return { ...kept, tilt };
  }
  return {
    mode: "free",
    tilt: 0,
    vx: 0,
    vy: 0,
    x: homing ? 0 : kept.x,
    y: homing ? 0 : kept.y,
  };
}

/** The CSS transform that puts a toy where its state says it is. */
export function transformOf(toy: Toy) {
  return `translate3d(${toy.x.toFixed(1)}px,${toy.y.toFixed(1)}px,0) rotate(${toy.tilt.toFixed(1)}deg)`;
}
