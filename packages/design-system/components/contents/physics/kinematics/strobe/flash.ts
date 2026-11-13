import { Array as Arr, Match, Schema } from "effect";

/**
 * Strobe photographs of falling and thrown balls: in a dark room a lamp
 * flashes at a steady rate and the camera's shutter stays open, so one
 * picture holds the ball at every flash. Equal times between images make
 * the spacing show the motion: even gaps sideways, growing gaps downward.
 * Gravity is rounded to 10 m/s², as the lessons do.
 */

/** Gravitational acceleration, in m/s². */
export const GRAVITY = 10;

/** The photographs a lesson can show. */
export const StrobeShotSchema = Schema.Literals([
  "drop",
  "toss",
  "launch",
  "components",
]);
export type StrobeShot = typeof StrobeShotSchema.Type;

/** One ball in a photograph: where it is at a time after release, in metres. */
const BallSchema = Schema.Struct({
  vx: Schema.Finite,
  vy: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});
type Ball = typeof BallSchema.Type;

/** A ball that starts at (x, y) with velocity (vx, vy) and then only falls. */
function thrown(start: Ball, time: number): Ball {
  return {
    vx: start.vx,
    vy: start.vy - GRAVITY * time,
    x: start.x + start.vx * time,
    y: start.y + start.vy * time - 0.5 * GRAVITY * time * time,
  };
}

/**
 * Each photograph: the balls at release, how long the shot lasts, the time
 * between flashes, and the part of the room the camera frames, in metres.
 * drop: from 1.8 m at rest. toss: up at 5 m/s from the hand. launch: one
 * ball dropped and one rolled off a 1.25 m table at 4 m/s, side by side.
 * components: kicked with vx = 6 m/s and vy = 8 m/s from the ground.
 */
export const STROBE_SHOTS = {
  components: {
    balls: [{ vx: 6, vy: 8, x: 0, y: 0 }],
    duration: 1.6,
    frame: { bottom: -0.3, left: -0.6, right: 10.2, top: 3.8 },
    interval: 0.2,
  },
  drop: {
    balls: [{ vx: 0, vy: 0, x: 0, y: 1.8 }],
    duration: 0.6,
    frame: { bottom: -0.1, left: -0.9, right: 0.9, top: 2 },
    interval: 0.1,
  },
  launch: {
    balls: [
      { vx: 0, vy: 0, x: 0, y: 1.25 },
      { vx: 4, vy: 0, x: 0, y: 1.25 },
    ],
    duration: 0.5,
    frame: { bottom: -0.1, left: -0.5, right: 2.5, top: 1.45 },
    interval: 0.05,
  },
  toss: {
    balls: [{ vx: 0, vy: 5, x: 0, y: 0 }],
    duration: 1,
    frame: { bottom: -0.25, left: -0.85, right: 0.85, top: 1.5 },
    interval: 0.1,
  },
} as const satisfies Record<
  StrobeShot,
  {
    balls: readonly Ball[];
    duration: number;
    frame: { bottom: number; left: number; right: number; top: number };
    interval: number;
  }
>;

/** Every ball of a shot at `time` after release. */
export function strobeBalls(shot: StrobeShot, time: number) {
  return Arr.map(STROBE_SHOTS[shot].balls, (ball) => thrown(ball, time));
}

/** The flash times of a shot, from release to the end. */
export function strobeFlashes(shot: StrobeShot) {
  const { duration, interval } = STROBE_SHOTS[shot];
  return Arr.makeBy(
    Math.round(duration / interval) + 1,
    (index) => index * interval
  );
}

/**
 * What the card reads for a shot: the start height, the time in the air,
 * and the outcome that shot is about: the landing speed of a drop, the top
 * of a toss, the reach of a ball rolled off a table, or the range of a kick.
 */
export function strobeFacts(shot: StrobeShot) {
  const { balls, duration } = STROBE_SHOTS[shot];
  const first = balls[0];
  const last = balls.at(-1) ?? first;
  const end = thrown(last, duration);
  const outcome = Match.value(shot).pipe(
    Match.when("drop", () => Math.abs(end.vy)),
    Match.when("toss", () => (first.vy * first.vy) / (2 * GRAVITY)),
    Match.orElse(() => end.x - last.x)
  );
  return { airTime: duration, height: first.y, outcome };
}
