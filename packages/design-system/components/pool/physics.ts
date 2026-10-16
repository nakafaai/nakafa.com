import {
  type Ball,
  BallSchema,
  fastest,
  fence,
  limitSpeed,
  tiltOf,
} from "@repo/design-system/components/pool/ball";
import { pushApart } from "@repo/design-system/components/pool/collide";
import {
  locate,
  measure,
  type Point,
  PointerSchema,
  PointSchema,
  pointerPush,
} from "@repo/design-system/components/pool/pointer";
import { Array as Arr, Number as Num, Option, Schema } from "effect";

/**
 * The physics of the pool: round balls that fall, pile up, and move away from a
 * pointer inside a box with four walls. Every function takes the state of the
 * pool and returns the next one, so nothing here reads a clock, a random number,
 * or the page.
 */

/** Gravity, in pixels per second squared. */
const GRAVITY = 1500;
/**
 * How much speed a free ball keeps each second: its speed is multiplied by `exp(-DAMPING * dt)`.
 * Measured with pointer sweeps over a settled pile: at 3 the pile rests within 55
 * frames, about a second, of the pointer stopping.
 */
const DAMPING = 3;
/** A held ball sits on its target at once. This share of its speed over half a frame is what it carries into a collision, its release, and its lean. */
const HOLD_SHARE = 0.35;
/** The pile is at rest while no ball moves faster than this, in pixels per second, counting each axis. This is 0.05 pixels in one step at the fixed step, written per second so that a step of another length keeps the same rule. */
const REST_SPEED = 24;
/**
 * The fixed step of the pool, in seconds: 480 steps make a second, and a frame at
 * 60 frames a second runs eight of them. A pile can still creep after the loop
 * sleeps, so the rest speed is a threshold, not a proof of rest.
 */
export const STEP = 1 / 480;
/** The most time one frame may move the pool, in seconds: a slow frame moves it in small steps, not in one jump. */
export const LONGEST_FRAME = 0.032;
/** The loop sleeps once the pile has rested for this many frames in a row, with nobody holding a ball. */
export const REST_FRAMES = 20;
/** The upward speed that a hop adds, in pixels per second, before its draw. */
const HOP_LIFT = 260;
/** The extra upward speed that a hop adds at the top of its draw, in pixels per second. */
const HOP_LIFT_SPREAD = 180;
/** The sideways speed that a hop adds across its draw, in pixels per second. */
const HOP_SIDE = 90;

/** The whole pool: the box, its balls, the time that the last frame left over, the pointer, the ball that is held and the grip where it was taken, and the fastest that a ball moved in the last frame, in pixels per second. */
export const WorldSchema = Schema.Struct({
  balls: Schema.Array(BallSchema),
  carry: Schema.Finite,
  grip: PointSchema,
  height: Schema.Finite,
  held: Schema.NullOr(Schema.Int),
  moved: Schema.Finite,
  pointer: PointerSchema,
  width: Schema.Finite,
});

/** The state of the pool. */
export type World = typeof WorldSchema.Type;

/**
 * Moves the pool for one frame that took `seconds`. The pointer's speed is measured
 * over that whole time. The frame runs as many whole steps as its time holds, and
 * keeps the rest for the next frame. The lean of every ball changes once per frame,
 * as the pool is drawn once per frame. The pool is at rest only when no step of the
 * frame moved a ball faster than the rest speed. A frame too short for one step
 * moves nothing, so it keeps the reading of the frame before.
 */
export function tick(world: World, seconds: number): World {
  const frame = Math.min(seconds, LONGEST_FRAME);
  const owed = world.carry + frame;
  const count = Math.floor(owed / STEP);
  let walked: World = { ...world, pointer: measure(world.pointer, seconds) };
  let fastestStep = 0;
  for (let index = 0; index < count; index += 1) {
    walked = step(walked, STEP, frame);
    fastestStep = Math.max(fastestStep, walked.moved);
  }
  const moved = count === 0 ? world.moved : fastestStep;
  const resting = isResting({ ...walked, moved });
  return {
    ...walked,
    balls: Arr.map(walked.balls, (ball) => ({
      ...ball,
      tilt: tiltOf(ball, resting),
    })),
    carry: owed - count * STEP,
    moved,
  };
}

/**
 * Moves every ball for `dt` seconds, of a frame that lasted `frame` seconds, and
 * pushes the balls apart. The free balls keep the top speed and stay in the box.
 */
export function step(world: World, dt: number, frame: number): World {
  const flown = Arr.map(world.balls, (ball, index) =>
    index === world.held ? holdAt(world, ball, frame) : flyBall(world, ball, dt)
  );
  const pushed = pushApart(flown, world.held);
  const kept = Arr.map(pushed, (ball, index) =>
    index === world.held
      ? ball
      : fence(limitSpeed(ball), world.width, world.height)
  );
  return { ...world, balls: kept, moved: travel(world.balls, kept, dt) };
}

/**
 * Takes the topmost ball under the point and keeps its grip. Nothing happens while
 * a ball is held: one ball belongs to one pointer.
 */
export function press(world: World, point: Point): World {
  if (world.held !== null) {
    return world;
  }
  const pointer = locate(world.pointer, point);
  const found = Arr.findLastIndex(world.balls, (ball) => covers(ball, point));
  if (Option.isNone(found)) {
    return { ...world, pointer };
  }
  const ball = Arr.getUnsafe(world.balls, found.value);
  return {
    ...world,
    grip: { x: ball.x - point.x, y: ball.y - point.y },
    held: found.value,
    pointer,
  };
}

/** The pointer moved over the box at `point`. */
export function move(world: World, point: Point): World {
  return {
    ...world,
    pointer: { ...locate(world.pointer, point), active: true },
  };
}

/** The pointer let go of the held ball. */
export function release(world: World): World {
  return { ...world, held: null };
}

/** The pointer left the box: it lets go of the held ball and stops pushing. */
export function leave(world: World): World {
  return {
    ...world,
    held: null,
    pointer: { ...world.pointer, active: false },
  };
}

/** The box changed size, so its walls move to its new edges. */
export function resize(world: World, width: number, height: number): World {
  return { ...world, height, width };
}

/**
 * Throws one ball up with a little sideways speed. `lift` and `side` are draws
 * from zero up to one, so the throw is different on every hop.
 */
export function hop(
  world: World,
  index: number,
  lift: number,
  side: number
): World {
  return {
    ...world,
    balls: Arr.map(world.balls, (ball, at) =>
      at === index
        ? {
            ...ball,
            vx: (side - 0.5) * HOP_SIDE,
            vy: -(HOP_LIFT + lift * HOP_LIFT_SPREAD),
          }
        : ball
    ),
  };
}

/** Whether the pile is at rest: no ball moved faster than the rest speed. */
export function isResting(world: World): boolean {
  return world.moved < REST_SPEED;
}

/**
 * A held ball goes to the pointer and its grip, inside the box. It hands on the
 * speed of its move over half a frame. The prototype moved the pool in two half
 * steps a frame, so a frame at any rate hands on the same speed for the same
 * pointer speed.
 */
function holdAt(world: World, ball: Ball, frame: number): Ball {
  const x = Num.clamp(world.pointer.x + world.grip.x, {
    maximum: world.width - ball.r,
    minimum: ball.r,
  });
  const y = Num.clamp(world.pointer.y + world.grip.y, {
    maximum: world.height - ball.r,
    minimum: ball.r,
  });
  const half = frame / 2;
  const speed = fastest(
    ((x - ball.x) / half) * HOLD_SHARE,
    ((y - ball.y) / half) * HOLD_SHARE
  );
  return { ...ball, inside: true, vx: speed.vx, vy: speed.vy, x, y };
}

/** A free ball falls, feels the pointer, loses a little speed, and moves; the walls then hold it. */
function flyBall(world: World, ball: Ball, dt: number): Ball {
  const pushed = pointerPush(world.pointer, ball, dt);
  const slowed = Math.exp(-DAMPING * dt);
  const speed = fastest(
    (ball.vx + pushed.vx) * slowed,
    (ball.vy + GRAVITY * dt + pushed.vy) * slowed
  );
  return fence(
    {
      ...ball,
      vx: speed.vx,
      vy: speed.vy,
      x: ball.x + speed.vx * dt,
      y: ball.y + speed.vy * dt,
    },
    world.width,
    world.height
  );
}

/** Whether the point lies inside a ball. */
function covers(ball: Ball, point: Point) {
  const dx = ball.x - point.x;
  const dy = ball.y - point.y;
  return dx * dx + dy * dy < ball.r * ball.r;
}

/** The fastest that a ball moved from one list of balls to the next, in pixels per second, counting each axis. */
function travel(before: readonly Ball[], after: readonly Ball[], dt: number) {
  return Arr.reduce(Arr.zip(before, after), 0, (largest, [start, end]) =>
    Math.max(
      largest,
      (Math.abs(end.x - start.x) + Math.abs(end.y - start.y)) / dt
    )
  );
}
