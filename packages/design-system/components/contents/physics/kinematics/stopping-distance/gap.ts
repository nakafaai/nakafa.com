import {
  type Stop,
  stopPosition,
  stoppingTime,
  stopSpeed,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import { Option, Schema } from "effect";

/**
 * Two cars on one lane at the same speed. The car in front brakes hard at
 * time zero; the learner's car behind keeps its speed through the driver's
 * reaction time, then brakes just as hard. The gap between them is a time
 * gap (the "two-second rule"), so at speed v it is v·h metres of road.
 */
export const FollowSchema = Schema.Struct({
  deceleration: Schema.Finite.check(Schema.isGreaterThan(0)),
  headway: Schema.Finite.check(Schema.isGreaterThan(0)),
  reaction: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  speed: Schema.Finite.check(Schema.isGreaterThan(0)),
});
export type Follow = typeof FollowSchema.Type;

/** The bisection steps that place a contact well under a millimetre. */
const CONTACT_STEPS = 60;

/** The stop of the car in front: it brakes at once. */
export function leadStop(follow: Follow): Stop {
  return {
    deceleration: follow.deceleration,
    reaction: 0,
    speed: follow.speed,
  };
}

/** The stop of the learner's car: it brakes after the reaction time. */
export function followerStop(follow: Follow): Stop {
  return {
    deceleration: follow.deceleration,
    reaction: follow.reaction,
    speed: follow.speed,
  };
}

/** The road between the two bumpers before anyone brakes, in metres. */
export function initialGap(follow: Follow) {
  return follow.speed * follow.headway;
}

/** The road between the bumpers `time` seconds after the front car braked. */
export function gapAt(follow: Follow, time: number) {
  return (
    initialGap(follow) +
    stopPosition(leadStop(follow), time) -
    stopPosition(followerStop(follow), time)
  );
}

/** When both cars stand still. */
export function settleTime(follow: Follow) {
  return stoppingTime(followerStop(follow));
}

/**
 * The gap once both cars stand still. Both brake equally hard, so the car
 * behind only loses the road it covered while its driver reacted:
 * v·h − v·t_r. The rear car never closes faster than that, so this is
 * also the smallest gap of the whole stop.
 */
export function finalGap(follow: Follow) {
  return gapAt(follow, settleTime(follow));
}

/**
 * The moment and the closing speed of a crash, when the gap runs out before
 * both cars stop. The gap only shrinks, so bisection finds where it reaches
 * zero.
 */
export function contactOf(follow: Follow) {
  if (finalGap(follow) >= 0) {
    return Option.none();
  }
  let early = 0;
  let late = settleTime(follow);
  for (let step = 0; step < CONTACT_STEPS; step += 1) {
    const middle = (early + late) / 2;
    if (gapAt(follow, middle) > 0) {
      early = middle;
    } else {
      late = middle;
    }
  }
  return Option.some({
    closing:
      stopSpeed(followerStop(follow), late) - stopSpeed(leadStop(follow), late),
    time: late,
  });
}
