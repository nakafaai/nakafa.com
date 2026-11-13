import { Schema } from "effect";

/**
 * One stop: a car moving at `speed` (m/s) keeps that speed for `reaction`
 * seconds, then brakes with a steady deceleration of `deceleration` (m/s²)
 * until it stands still. Every stopping simulation of the lesson draws from
 * this one model: d = v·t_r + v²/(2b).
 */
export const StopSchema = Schema.Struct({
  deceleration: Schema.Finite.check(Schema.isGreaterThan(0)),
  reaction: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  speed: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type Stop = typeof StopSchema.Type;

/** How far the car rolls before the brakes act: v·t_r. */
export function reactionDistance(stop: Stop) {
  return stop.speed * stop.reaction;
}

/** How far the car slides while it brakes to rest: v²/(2b). */
export function brakingDistance(stop: Stop) {
  return stop.speed ** 2 / (2 * stop.deceleration);
}

/** How long the brakes take to bring the car to rest: v/b. */
export function brakingTime(stop: Stop) {
  return stop.speed / stop.deceleration;
}

/** The whole distance from the hazard to rest. */
export function stoppingDistance(stop: Stop) {
  return reactionDistance(stop) + brakingDistance(stop);
}

/** The time from the hazard to rest. */
export function stoppingTime(stop: Stop) {
  return stop.reaction + brakingTime(stop);
}

/** The distance covered `time` seconds after the hazard appeared. */
export function stopPosition(stop: Stop, time: number) {
  if (time <= 0) {
    return 0;
  }
  if (time <= stop.reaction) {
    return stop.speed * time;
  }
  const braking = Math.min(time - stop.reaction, brakingTime(stop));
  return (
    reactionDistance(stop) +
    stop.speed * braking -
    (stop.deceleration * braking ** 2) / 2
  );
}

/** The speed `time` seconds after the hazard appeared. */
export function stopSpeed(stop: Stop, time: number) {
  if (time <= stop.reaction) {
    return stop.speed;
  }
  return Math.max(0, stop.speed - stop.deceleration * (time - stop.reaction));
}

/** Which part of the stop the car is in at `time`. */
export function stopPhase(
  stop: Stop,
  time: number
): "reaction" | "braking" | "rest" {
  if (time < stop.reaction) {
    return "reaction";
  }
  if (time < stoppingTime(stop)) {
    return "braking";
  }
  return "rest";
}
