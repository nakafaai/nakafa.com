import {
  carryChain,
  digitsOf,
  PLACES,
} from "@repo/design-system/components/contents/mathematics/abacus/place";
import {
  BEAD,
  CLEAR,
  ease,
  FLIGHT_SPEED,
  legDuration,
  POT,
  STACK_SPEED,
  SUNK,
  slotY,
  spikeX,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";
import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * Adding one to the number on a spike abacus, as moves of beads. A bead comes
 * out of the pot, travels just above the tips and slides down the units
 * spike. If that fills the spike to b beads, the stack slides up the spike
 * and its beads leave the tip one after another, flying back to the pot, and
 * one bead comes out to the next spike to the left, which may fill and carry
 * in turn. Every path is straight legs in the plane of the spikes.
 */

/** A point in the plane of the spikes: across the base, and up from the desk. */
const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type Point = typeof PointSchema.Type;

/**
 * One straight leg of a path, how long it takes, and whether it starts and
 * stops at rest or keeps one speed throughout.
 */
const LegSchema = Schema.Struct({
  duration: Schema.Finite,
  eased: Schema.Boolean,
  from: PointSchema,
  to: PointSchema,
});
type Leg = typeof LegSchema.Type;

/** How far along a path the walk has come: the point reached and the time still to spend. */
const ReachSchema = Schema.Struct({ point: PointSchema, rest: Schema.Finite });
type Reach = typeof ReachSchema.Type;

/**
 * One move of an increment: a `drop` brings one bead to slot `count` on the
 * spike of `place`, and a `lift` carries the `count` beads of a full spike
 * back to the pot.
 */
const StepSchema = Schema.Struct({
  count: Schema.Int,
  kind: Schema.Literals(["drop", "lift"]),
  place: Schema.Int,
});
type Step = typeof StepSchema.Type;

/**
 * A step with its path, when it starts and how long it lasts, in seconds from
 * the increment's start. A drop's path is its bead's; a lift's is the flight
 * every bead takes from the tip to the pot.
 */
const MoveSchema = Schema.Struct({
  ...StepSchema.fields,
  duration: Schema.Finite,
  legs: Schema.Array(LegSchema),
  start: Schema.Finite,
});
export type Move = typeof MoveSchema.Type;

/** Where one moving bead of `place` is. */
const PoseSchema = Schema.Struct({
  place: Schema.Int,
  x: Schema.Finite,
  y: Schema.Finite,
});
export type Pose = typeof PoseSchema.Type;

/** How many beads rest on each spike, units first, and every bead in the air. */
const FrameSchema = Schema.Struct({
  moving: Schema.Array(PoseSchema),
  resting: Schema.Array(Schema.Int),
});
type Frame = typeof FrameSchema.Type;

/** The legs between each pair of `points`, each lasting as long as `duration` gives for its length. */
function pathThrough(
  points: readonly [Point, ...Point[]],
  eased: boolean,
  duration: (length: number) => number
): readonly Leg[] {
  return Arr.map(Arr.zip(points, Arr.drop(points, 1)), ([from, to]) => ({
    duration: duration(Math.hypot(to[0] - from[0], to[1] - from[1])),
    eased,
    from,
    to,
  }));
}

/** How long a path takes, end to end. */
function pathDuration(legs: readonly Leg[]) {
  return Arr.reduce(legs, 0, (total, leg) => total + leg.duration);
}

/** Where a path has reached `time` seconds after it started; its start before, its end after. */
export function pointOnPath(legs: readonly Leg[], time: number): Point {
  const reached = Arr.reduce(
    legs,
    { point: legs[0]?.from ?? [0, 0], rest: time },
    ({ point, rest }, leg): Reach => {
      if (rest <= 0) {
        return { point, rest };
      }
      const share = Math.min(rest / leg.duration, 1);
      const progress = leg.eased ? ease(share) : share;
      return {
        point: [
          leg.from[0] + (leg.to[0] - leg.from[0]) * progress,
          leg.from[1] + (leg.to[1] - leg.from[1]) * progress,
        ],
        rest: rest - leg.duration,
      };
    }
  );
  return reached.point;
}

/** A bead out of the pot, over the tips, and down the spike of `place` to `slot`, at rest at every corner. */
function dropPath(place: number, slot: number) {
  return pathThrough(
    [
      [POT.x, SUNK],
      [POT.x, CLEAR],
      [spikeX(place), CLEAR],
      [spikeX(place), slotY(slot)],
    ],
    true,
    legDuration
  );
}

/**
 * How a bead leaves the top of a rising stack: up and aside together, so it
 * climbs away from the bead below faster than the stack rises, and is a bead
 * width clear of it before it levels out.
 */
const PEEL = { across: 0.03, up: 0.02 } as const;

/**
 * A bead's flight at one speed from the tip of the spike of `place`: peeled
 * off the stack, level over the tips, and down into the pot below the loose
 * beads.
 */
function flightPath(place: number) {
  const high = CLEAR + PEEL.up;
  return pathThrough(
    [
      [spikeX(place), CLEAR],
      [spikeX(place) + PEEL.across, high],
      [POT.x, high],
      [POT.x, SUNK - BEAD.pitch],
    ],
    false,
    (length) => length / FLIGHT_SPEED
  );
}

/** When the bead in `slot` of a lifting stack reaches the tip and flies, in seconds from the lift's start. */
function leaveTime(slot: number) {
  return (CLEAR - slotY(slot)) / STACK_SPEED;
}

/**
 * The moves that add one to `value` in `base`, each starting where the one
 * before it ends: a bead onto the units spike, then for every spike it fills
 * the lift of its b beads and a bead onto the next spike. After the largest
 * number the last lift leaves every spike empty, so counting starts again
 * from 0.
 */
export function incrementPlan(value: number, base: number): readonly Move[] {
  const digits = digitsOf(value, base);
  const digitAt = (place: number) => Arr.getUnsafe(digits, place);
  const carries = Arr.flatMap(
    Arr.take(Arr.range(0, PLACES - 1), carryChain(value, base)),
    (place): readonly Step[] => {
      const lift: Step = { count: base, kind: "lift", place };
      return place + 1 < PLACES
        ? [lift, { count: digitAt(place + 1), kind: "drop", place: place + 1 }]
        : [lift];
    }
  );
  const steps: readonly Step[] = [
    { count: digitAt(0), kind: "drop", place: 0 },
    ...carries,
  ];
  return Arr.reduce(steps, Arr.empty<Move>(), (moves, step) => {
    const start = Option.match(Arr.last(moves), {
      onNone: () => 0,
      onSome: (last) => last.start + last.duration,
    });
    const timed = Match.value(step.kind).pipe(
      Match.when("drop", () => {
        const legs = dropPath(step.place, step.count);
        return { duration: pathDuration(legs), legs };
      }),
      Match.when("lift", () => {
        const legs = flightPath(step.place);
        return { duration: leaveTime(0) + pathDuration(legs), legs };
      }),
      Match.exhaustive
    );
    return [...moves, { ...step, ...timed, start }];
  });
}

/** How long adding one takes, from the first bead leaving the pot to the last move's end. */
export function planDuration(plan: readonly Move[]) {
  return Arr.reduce(plan, 0, (end, move) =>
    Math.max(end, move.start + move.duration)
  );
}

/** Whether a bead at `pose` has sunk among the loose beads in the pot, out of sight. */
function sunk(pose: Pose) {
  return pose.y < SUNK && Math.abs(pose.x - POT.x) < POT.radius;
}

/**
 * Where the beads of a lift are `time` seconds after it started: the stack
 * slides up its spike, and each bead that reaches the tip flies on to the pot.
 */
function liftBeads(move: Move, time: number): readonly Pose[] {
  return Arr.map(Arr.range(0, move.count - 1), (slot) => {
    const flying = time - leaveTime(slot);
    if (flying < 0) {
      return {
        place: move.place,
        x: spikeX(move.place),
        y: slotY(slot) + STACK_SPEED * time,
      };
    }
    const [x, y] = pointOnPath(move.legs, flying);
    return { place: move.place, x, y };
  });
}

/** The beads a move has in the air `time` seconds after it started, those sunk in the pot left out. */
function movingBeads(move: Move, time: number): readonly Pose[] {
  return Match.value(move.kind).pipe(
    Match.when("drop", () => {
      const [x, y] = pointOnPath(move.legs, time);
      return [{ place: move.place, x, y }];
    }),
    Match.when("lift", () =>
      Arr.filter(liftBeads(move, time), (pose) => !sunk(pose))
    ),
    Match.exhaustive
  );
}

/**
 * What the abacus shows `time` seconds into adding one to `value` in `base`:
 * how many beads rest on each spike, units first, and where every bead in
 * the air is. A drop leaves its spike as it was until the bead lands; a lift
 * empties its spike the moment the stack starts to rise.
 */
export function incrementFrame(value: number, base: number, time: number) {
  const still: Frame = { moving: [], resting: digitsOf(value, base) };
  return Arr.reduce(incrementPlan(value, base), still, (shown, move): Frame => {
    const elapsed = time - move.start;
    if (elapsed < 0) {
      return shown;
    }
    const done = time >= move.start + move.duration;
    const resting = Arr.map(shown.resting, (count, place) => {
      if (place !== move.place) {
        return count;
      }
      if (move.kind === "lift") {
        return 0;
      }
      return done ? count + 1 : count;
    });
    return {
      moving: done
        ? shown.moving
        : [...shown.moving, ...movingBeads(move, elapsed)],
      resting,
    };
  });
}
