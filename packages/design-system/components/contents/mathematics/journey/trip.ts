import { Array as Arr, Option, Schema } from "effect";

/**
 * A journey along one straight road, as a lesson writes it: legs one after
 * another, each lasting some minutes and changing the traveller's distance
 * from the start by some kilometres, positive away from the start, zero at a
 * stop and negative back toward it. Its distance-time graph is a line of
 * straight segments, one for each leg, and the slope of each is its speed.
 */

/** One leg: how long it lasts in minutes, and how its distance from the start changes, in kilometres. */
const LegSchema = Schema.Struct({
  change: Schema.Finite,
  minutes: Schema.Finite,
});
export type Leg = typeof LegSchema.Type;

/** A traveller's journey: the minute it leaves, how far from the start it leaves from, and its legs. */
const TripSchema = Schema.Struct({
  depart: Schema.Finite,
  from: Schema.Finite,
  legs: Schema.NonEmptyArray(LegSchema),
});
export type Trip = typeof TripSchema.Type;

/** One leg on the clock: the minutes it starts and ends, and its distances from the start then. */
const StageSchema = Schema.Struct({
  end: Schema.Finite,
  from: Schema.Finite,
  start: Schema.Finite,
  to: Schema.Finite,
});
export type Stage = typeof StageSchema.Type;

/** A traveller as the lab names it: its name, and its legs on the clock. */
const TravellerSchema = Schema.Struct({
  name: Schema.String,
  stages: Schema.NonEmptyArray(StageSchema),
});
export type Traveller = typeof TravellerSchema.Type;

/** What a traveller does on a leg: moves away from the start, stands still, or heads back toward it. */
const MotionSchema = Schema.Literals(["away", "still", "back"]);
export type Motion = typeof MotionSchema.Type;

/** How many minutes an hour has, for a speed in kilometres an hour. */
const HOUR = 60;

/** Where a traveller is and when: its distance from the start, at a minute of the clock. */
const MomentSchema = Schema.Struct({
  at: Schema.Finite,
  minute: Schema.Finite,
});
type Moment = typeof MomentSchema.Type;

/** The legs of a trip on the clock, one after another from its departure. */
export function stagesOf(trip: Trip) {
  const [, stages] = Arr.mapAccum(
    trip.legs,
    { at: trip.from, minute: trip.depart },
    (now: Moment, leg: Leg): readonly [Moment, Stage] => {
      const next = {
        at: now.at + leg.change,
        minute: now.minute + leg.minutes,
      };
      return [
        next,
        { end: next.minute, from: now.at, start: now.minute, to: next.at },
      ];
    }
  );
  return stages;
}

/** The minute a trip arrives: the end of its last leg. */
export function arrivalOf(stages: Arr.NonEmptyReadonlyArray<Stage>) {
  return Arr.lastNonEmpty(stages).end;
}

/**
 * How far from the start a traveller is at `minute`. Before it leaves it
 * waits where it starts, and once it arrives it stays where it ends.
 */
export function placeAt(
  stages: Arr.NonEmptyReadonlyArray<Stage>,
  minute: number
) {
  return Option.match(
    Arr.findFirst(stages, (stage) => minute <= stage.end),
    {
      onNone: () => Arr.lastNonEmpty(stages).to,
      onSome: (stage) => {
        const share =
          Math.max(0, minute - stage.start) / (stage.end - stage.start);
        return stage.from + (stage.to - stage.from) * share;
      },
    }
  );
}

/**
 * Which leg is under way at `minute`. The moment a leg ends belongs to it, so
 * the end of a leg shows that leg whole; before the first leg it is the first,
 * and after the last the last.
 */
export function partAt(
  stages: Arr.NonEmptyReadonlyArray<Stage>,
  minute: number
) {
  return Option.getOrElse(
    Arr.findFirstIndex(stages, (stage) => minute <= stage.end),
    () => stages.length - 1
  );
}

/** The letters of the graph's corners after O, as a textbook names the ends of a journey's legs. */
const LETTERS = "ABCDEFGHIJ";

/** The name of the graph's corner where leg `index` starts: O at the origin, then A, B, C and on. */
export function cornerName(index: number) {
  return index === 0 ? "O" : LETTERS.charAt(index - 1);
}

/** The name of leg `index` by its two corners, such as OA or BC. */
export function partName(index: number) {
  return `${cornerName(index)}${cornerName(index + 1)}`;
}

/** What the traveller does on a leg. */
export function motionOf(stage: Stage): Motion {
  if (stage.to > stage.from) {
    return "away";
  }
  return stage.to < stage.from ? "back" : "still";
}

/** How far a traveller covers on a leg, in kilometres, whichever way it goes. */
export function lengthOf(stage: Stage) {
  return Math.abs(stage.to - stage.from);
}

/** A leg's speed in kilometres an hour: the distance it covers over the time it takes. */
export function speedOf(stage: Stage) {
  return (lengthOf(stage) * HOUR) / (stage.end - stage.start);
}

/**
 * The whole trip: the distance it covers, every leg counted whichever way it
 * goes, the minutes it takes from leaving to arriving, and its average speed
 * in kilometres an hour, the total distance over the total time.
 */
export function totalsOf(stages: Arr.NonEmptyReadonlyArray<Stage>) {
  const distance = Arr.reduce(stages, 0, (sum, stage) => sum + lengthOf(stage));
  const minutes = arrivalOf(stages) - Arr.headNonEmpty(stages).start;
  return { distance, minutes, speed: (distance * HOUR) / minutes };
}

/** The farthest from the start a trip ever is, in kilometres. */
export function farthestOf(stages: Arr.NonEmptyReadonlyArray<Stage>) {
  return Arr.reduce(stages, Arr.headNonEmpty(stages).from, (most, stage) =>
    Math.max(most, stage.to)
  );
}

/**
 * Which way a traveller faces at `minute`, from 0 facing away from the start
 * to 1 facing back toward it. On a moving leg it faces where it goes. At a
 * stop it turns round in the middle of its wait when its next move goes the
 * other way, so a bus turns at the end of the line while it waits there.
 */
export function facingAt(
  stages: Arr.NonEmptyReadonlyArray<Stage>,
  minute: number
) {
  const facing = (stage: Stage) => Number(motionOf(stage) === "back");
  const moving = (stage: Stage) => motionOf(stage) !== "still";
  const index = partAt(stages, minute);
  const stage = Arr.getUnsafe(stages, index);
  if (moving(stage)) {
    return facing(stage);
  }
  const before = Arr.findLast(Arr.take(stages, index), moving);
  const after = Arr.findFirst(Arr.drop(stages, index + 1), moving);
  const first = Option.getOrElse(
    Option.orElse(before, () => after),
    () => stage
  );
  const next = Option.getOrElse(after, () => first);
  const share = (minute - stage.start) / (stage.end - stage.start);
  const turn = Math.min(1, Math.max(0, (share - 0.3) / 0.4));
  return (
    facing(first) +
    (facing(next) - facing(first)) * turn * turn * (3 - 2 * turn)
  );
}
