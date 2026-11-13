import { Schema } from "effect";

/**
 * A boat crossing a river that flows east. The boat moves through the water
 * at its own speed in the direction it heads; the water carries everything
 * downstream at the current's speed. Seen from the bank, the boat's velocity
 * is the sum of the two, so it crosses on a slant, and heading a little
 * upstream can cancel the drift.
 */

/** A river and a boat: width in metres, speeds in m/s. */
export const RiverSchema = Schema.Struct({
  boatSpeed: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  current: Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  width: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type River = typeof RiverSchema.Type;

/**
 * The crossing for a heading, in degrees from straight across, negative
 * upstream: the bank-frame velocity (downstream and across), its size and
 * its angle from straight across, the time to reach the far bank, and how
 * far downstream the boat lands. A boat that heads so far upstream that it
 * never gains ground across has no crossing.
 */
export function riverCrossing(river: River, heading: number) {
  const angle = (heading * Math.PI) / 180;
  const across = river.boatSpeed * Math.cos(angle);
  const downstream = river.current + river.boatSpeed * Math.sin(angle);
  // Heading along the bank leaves a rounding remainder of cos 90 degrees, not zero.
  if (across <= river.boatSpeed * 1e-9) {
    return;
  }
  const time = river.width / across;
  return {
    across,
    angle: (Math.atan2(downstream, across) * 180) / Math.PI,
    downstream,
    drift: downstream * time,
    speed: Math.hypot(across, downstream),
    time,
  };
}

/** The heading upstream, in degrees, that cancels the drift, when the boat is faster than the current. */
export function straightHeading(river: River) {
  return river.current < river.boatSpeed
    ? (-Math.asin(river.current / river.boatSpeed) * 180) / Math.PI
    : undefined;
}
