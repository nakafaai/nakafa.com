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
  fadePointer,
  idlePointer,
  locate,
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
/** How much speed a free ball keeps each second: its speed is multiplied by `exp(-DAMPING * dt)`. */
const DAMPING = 0.95;
/** A held ball sits on its target at once. This share of the speed that gets it there is what it carries into a collision, its release, and its lean. */
const HOLD_SHARE = 0.35;
/** The pile is at rest when no ball traveled this far in the last step, in pixels. */
const REST_TRAVEL = 0.05;
/**
 * The fixed step of the pool, in seconds: 480 steps make a second, and a frame at
 * 60 frames a second runs eight of them. Measured on the 30 members at 60 frames a
 * second in 20 box sizes from 390 to 1463 wide and from 500 to 1440 high: two half
 * steps a frame kept the loop awake for 3600 frames in 18 of them, while steps of
 * this length let it sleep after 153 to 394 frames (184 frames in a box of 1200 by
 * 640).
 */
export const STEP = 1 / 480;
/** The most time one frame may move the pool, in seconds: a slow frame moves it in small steps, not in one jump. */
export const LONGEST_FRAME = 0.032;
/** How far above the box a ball may start, in box heights. */
const DROP_SPAN = 1.2;
/** The upward speed that a hop adds, in pixels per second, before its draw. */
const HOP_LIFT = 260;
/** The extra upward speed that a hop adds at the top of its draw, in pixels per second. */
const HOP_LIFT_SPREAD = 180;
/** The sideways speed that a hop adds across its draw, in pixels per second. */
const HOP_SIDE = 90;

/** The whole pool: the box, its balls, the time that the last frame left over, the pointer, the ball that is held and the grip where it was taken, and the farthest that a ball moved in the last step. */
const WorldSchema = Schema.Struct({
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

/** Where a ball starts: its radius, its place as fractions of the box, and its first sideways speed. */
const StartSchema = Schema.Struct({
  fx: Schema.Finite,
  fy: Schema.Finite,
  r: Schema.Finite,
  vx: Schema.Finite,
});

/** How one ball starts. */
export type Start = typeof StartSchema.Type;

/** The pool before anything moves: every ball waits above the box, spread across it. */
export function createWorld(
  width: number,
  height: number,
  starts: readonly Start[]
): World {
  return {
    balls: Arr.map(starts, (start) => ({
      inside: false,
      r: start.r,
      tilt: 0,
      vx: start.vx,
      vy: 0,
      x: start.r + start.fx * Math.max(1, width - start.r * 2),
      y: -start.r - start.fy * height * DROP_SPAN,
    })),
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
 * Moves the pool for one frame that took `seconds`. The frame runs as many whole
 * steps as its time holds, and keeps the rest for the next frame. The lean of
 * every ball and the fade of the pointer's speed change once per frame, as the
 * pool is drawn once per frame.
 */
export function tick(world: World, seconds: number): World {
  const owed = world.carry + Math.min(seconds, LONGEST_FRAME);
  const count = Math.floor(owed / STEP);
  let walked = world;
  for (let index = 0; index < count; index += 1) {
    walked = step(walked, STEP);
  }
  const resting = isResting(walked);
  return {
    ...walked,
    balls: Arr.map(walked.balls, (ball) => ({
      ...ball,
      tilt: tiltOf(ball, resting),
    })),
    carry: owed - count * STEP,
    pointer: fadePointer(walked.pointer),
  };
}

/** Moves every ball for `dt` seconds, pushes the balls apart, and keeps the free ones at the top speed and in the box. */
export function step(world: World, dt: number): World {
  const flown = Arr.map(world.balls, (ball, index) =>
    index === world.held ? holdAt(world, ball, dt) : flyBall(world, ball, dt)
  );
  const pushed = pushApart(flown, world.held);
  const kept = Arr.map(pushed, (ball, index) =>
    index === world.held
      ? ball
      : fence(limitSpeed(ball), world.width, world.height)
  );
  return { ...world, balls: kept, moved: travel(world.balls, kept) };
}

/**
 * Moves the pool `steps` times at the fixed step, then stops the sideways speed and
 * the lean of every ball, so the pile stands still on its first paint.
 */
export function settle(world: World, steps: number): World {
  let walked = world;
  for (let count = 0; count < steps; count += 1) {
    walked = step(walked, STEP);
  }
  return {
    ...walked,
    balls: Arr.map(walked.balls, (ball) => ({ ...ball, tilt: 0, vx: 0 })),
  };
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

/** Whether the pile is at rest: no ball traveled as far as the rest distance in the last step. */
export function isResting(world: World): boolean {
  return world.moved < REST_TRAVEL;
}

/** A held ball goes to the pointer and its grip, inside the box, at a speed that gets it there. */
function holdAt(world: World, ball: Ball, dt: number): Ball {
  const x = Num.clamp(world.pointer.x + world.grip.x, {
    maximum: world.width - ball.r,
    minimum: ball.r,
  });
  const y = Num.clamp(world.pointer.y + world.grip.y, {
    maximum: world.height - ball.r,
    minimum: ball.r,
  });
  const speed = fastest(
    ((x - ball.x) / dt) * HOLD_SHARE,
    ((y - ball.y) / dt) * HOLD_SHARE
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

/** The farthest that a ball traveled from one list of balls to the next, counting each axis. */
function travel(before: readonly Ball[], after: readonly Ball[]) {
  return Arr.reduce(Arr.zip(before, after), 0, (largest, [start, end]) =>
    Math.max(largest, Math.abs(end.x - start.x) + Math.abs(end.y - start.y))
  );
}
