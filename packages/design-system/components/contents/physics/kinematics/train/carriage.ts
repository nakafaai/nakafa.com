import { Schema } from "effect";

/**
 * A passenger walking along a moving train. Relative to the carriage the
 * passenger walks at a steady pace, forward or backward; relative to the
 * platform the passenger's velocity is the train's velocity plus the
 * walking velocity. The numbers follow a commuter train at 20 m/s (72 km/h)
 * and a walking pace of 1.5 m/s.
 */

/** Which way the passenger walks along the carriage. */
export const WalkWaySchema = Schema.Literals(["forward", "backward"]);
export type WalkWay = typeof WalkWaySchema.Type;

/** Who watches: someone standing on the platform, or someone seated in the train. */
export const ObserverSchema = Schema.Literals(["platform", "train"]);
export type Observer = typeof ObserverSchema.Type;

/** The passenger's velocity seen by each observer, in m/s, positive in the train's direction. */
export function passengerVelocity(
  train: number,
  walk: number,
  way: WalkWay,
  observer: Observer
) {
  const walking = way === "forward" ? walk : -walk;
  return observer === "train" ? walking : train + walking;
}

/** The train's own velocity seen by each observer, in m/s. */
export function trainVelocity(train: number, observer: Observer) {
  return observer === "train" ? 0 : train;
}
