import {
  DIE,
  FACE_UP,
  FaceSchema,
} from "@repo/design-system/components/contents/mathematics/dice/faces";
import {
  axisAngle,
  inverse,
  multiply,
  QuaternionSchema,
  rotate,
  slerp,
  TripleSchema,
} from "@repo/design-system/components/contents/mathematics/dice/turn";
import { Schema } from "effect";

/**
 * How a die is thrown into the tray and comes to rest, as a pure function of
 * time. It drops in, bounces twice and loses most of its height to each
 * bounce, then rolls over its edges and slows until it lies flat on the face
 * it was drawn to show. Its centre never sinks below the depth its lowest
 * corner reaches at that moment, so it never cuts into the felt, and every
 * spin unwinds to zero, so it lands exactly on its face.
 */

/**
 * A felt-lined dice tray, inside its walls, in metres: 200 mm by 140 mm,
 * the walls 12 mm thick and 36 mm tall above a 14 mm floor. The floor is
 * thick enough to hide the stage's contact shadows, which lie 12 mm above
 * the table, inside the wood rather than over the felt.
 */
export const TRAY = {
  floor: 0.014,
  height: 0.036,
  length: 0.2,
  wall: 0.012,
  width: 0.14,
} as const;

/** The top of the 1 mm felt on the tray's floor, where a die comes to rest. */
export const FELT = TRAY.floor + 0.001;

/** How high above the felt the hand lets a die go, in metres. */
const DROP = 0.08;

/** The share of its speed a die keeps at each bounce on felt. */
const RESTITUTION = 0.4;

/** How many times a die bounces before it only rolls. */
const BOUNCES = 2;

/** Gravitational acceleration, in metres per second squared. */
const GRAVITY = 9.81;

/** How far a die travels along the tray from where it lands, in metres. */
export const TRAVEL = 0.075;

/** The share of its travel a die rolls over its edges; it slides the rest. */
const ROLLING = 0.7;

/** Whole turns a die makes about its direction of travel while in the air. */
const TWISTS = 2;

/** How far a die turns about the vertical while it rolls, in radians. */
const SPIN = 2.4;

/** The share of the tumble a die spends in the air before it only rolls. */
const AIRBORNE = 0.35;

/** How high a hand lifts a die above the line between rest and the next throw. */
const LIFT = 0.05;

/** The vertical, which a die's yaw turns about. */
const UP = [0, 1, 0] as const;

/** One throw of one die: the face it shows, where it stops, and how it turns on the way. */
export const ThrowSchema = Schema.Struct({
  face: FaceSchema,
  lane: Schema.Finite,
  rest: Schema.Tuple([Schema.Finite, Schema.Finite]),
  twist: Schema.Literals([-1, 1]),
  yaw: Schema.Finite,
});
export type Throw = typeof ThrowSchema.Type;

/** Where a die is and how it is turned at one moment. */
export const PoseSchema = Schema.Struct({
  position: TripleSchema,
  turn: QuaternionSchema,
});
export type Pose = typeof PoseSchema.Type;

/**
 * How far below its centre a turned die reaches: a rounded cube is a smaller
 * cube grown by the edge radius, so its depth along the vertical is the
 * smaller cube's half-width times the sum of the vertical's parts in the
 * die's frame, plus the radius.
 */
export function lowestPoint(turn: Pose["turn"]) {
  const [x, y, z] = rotate(inverse(turn), [0, -1, 0]);
  return (
    (DIE.half - DIE.radius) * (Math.abs(x) + Math.abs(y) + Math.abs(z)) +
    DIE.radius
  );
}

/**
 * The height above the felt, in metres, of a die let go `drop` metres up,
 * `time` seconds after it was let go: a free fall, then bounces that each
 * keep `RESTITUTION` of the speed, then rest.
 */
export function airborne(time: number, drop: number) {
  const fall = Math.sqrt((2 * drop) / GRAVITY);
  if (time < fall) {
    return drop - (GRAVITY * time ** 2) / 2;
  }
  return bounce(time - fall, drop * RESTITUTION ** 2, BOUNCES);
}

/** The height during the bounces after a fall, each `peak` metres high. */
function bounce(time: number, peak: number, left: number): number {
  if (left === 0) {
    return 0;
  }
  const flight = 2 * Math.sqrt((2 * peak) / GRAVITY);
  if (time < flight) {
    return (GRAVITY * flight * time) / 2 - (GRAVITY * time ** 2) / 2;
  }
  return bounce(time - flight, peak * RESTITUTION ** 2, left - 1);
}

/** The turn a die rests in at the end of a throw: its face up, turned by the throw's yaw. */
function restTurn(roll: Throw) {
  return multiply(axisAngle(UP, roll.yaw), FACE_UP[roll.face]);
}

/** Where a die lies once a throw has stopped. */
export function restPose(roll: Throw): Pose {
  return {
    position: [roll.rest[0], FELT + DIE.half, roll.rest[1]],
    turn: restTurn(roll),
  };
}

/**
 * A die `progress` of the way through a throw's tumble, which lasts
 * `seconds`. A throw of `amplitude` below 1 is a quicker, smaller toss: it
 * drops from lower, travels and turns less, as dice do when they are rolled
 * fast and many times over.
 */
export function tumblePose(
  roll: Throw,
  progress: number,
  amplitude: number,
  seconds: number
): Pose {
  const done = Math.min(1, Math.max(0, progress));
  const left = (1 - done) ** 3;
  const travel = TRAVEL * amplitude;
  const rolled = ((travel * ROLLING) / DIE.half) * left;
  const flying = (1 - Math.min(1, done / AIRBORNE)) ** 2;
  const twisted = roll.twist * 2 * Math.PI * TWISTS * amplitude * flying;
  const turn = multiply(
    axisAngle(UP, roll.twist * SPIN * amplitude * left),
    multiply(
      axisAngle([0, 0, 1], rolled),
      multiply(axisAngle([1, 0, 0], twisted), restTurn(roll))
    )
  );
  const height = airborne(done * seconds, DROP * amplitude ** 2);
  return {
    position: [
      roll.rest[0] - travel * left,
      FELT + lowestPoint(turn) + height,
      roll.rest[1] + (roll.lane - roll.rest[1]) * left,
    ],
    turn,
  };
}

/**
 * A die `share` of the way from where it lay to where the next throw lets it
 * go, lifted over the felt on the way, as a hand gathers it up.
 */
export function gatherPose(from: Pose, to: Pose, share: number): Pose {
  const eased = share ** 2 * (3 - 2 * share);
  const turn = slerp(from.turn, to.turn, eased);
  const blend = (index: 0 | 1 | 2) =>
    from.position[index] + (to.position[index] - from.position[index]) * eased;
  return {
    position: [
      blend(0),
      Math.max(
        blend(1) + LIFT * Math.sin(Math.PI * share),
        FELT + lowestPoint(turn)
      ),
      blend(2),
    ],
    turn,
  };
}
