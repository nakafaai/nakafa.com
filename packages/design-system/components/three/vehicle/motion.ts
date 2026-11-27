/**
 * How a boat answers to its motion: how its bow lifts with its speed, how
 * strong the wake behind it is, and how a hull at rest rides the ripples.
 * Every answer is a plain number computed from numbers, so a lab calls them
 * each frame without allocating.
 */

/** The standard acceleration of free fall, in m/s². */
const GRAVITY = 9.81;

/**
 * The half-angle of the wedge a boat's wake fills on deep water, in radians:
 * asin(1/3), about 19.47 degrees, at every speed (Kelvin 1887, "On ship
 * waves").
 */
export const WAKE_ANGLE = Math.asin(1 / 3);

/**
 * The Froude number of a hull: its speed over the speed of a wave as long as
 * its waterline. Below about 0.4 a hull sits level in the water, near 0.5 it
 * climbs its own bow wave, and beyond 1 it planes.
 *
 * @param speed - The hull's speed through the water, in m/s
 * @param length - The hull's waterline length, in metres
 */
export function froudeAt(speed: number, length: number) {
  return Math.abs(speed) / Math.sqrt(GRAVITY * length);
}

/**
 * How far a small boat's bow lifts at a speed, in radians: nothing at rest,
 * most as it climbs its bow wave near a Froude number of 0.6, and less again
 * once it planes.
 *
 * @param speed - The hull's speed through the water, in m/s
 * @param length - The hull's waterline length, in metres
 */
export function trimAt(speed: number, length: number) {
  const froude = froudeAt(speed, length);
  const hump = froude / 0.6;
  return 0.11 * hump * Math.exp(1 - hump);
}

/**
 * How strongly a hull's wake shows, from 0 for a hull at rest to 1 for one
 * that throws a full wake: it grows with the Froude number and levels off.
 *
 * @param speed - The hull's speed through the water, in m/s
 * @param length - The hull's waterline length, in metres
 */
export function wakeStrength(speed: number, length: number) {
  return 1 - Math.exp(-3 * froudeAt(speed, length));
}

/**
 * How a hull rides small ripples at a moment: its heave in metres and its
 * roll and pitch in radians, each a slow sum of two waves that never quite
 * repeat, scaled by how lively the water is.
 *
 * @param time - The water's time, in seconds
 * @param lively - How lively the water is: 1 for a calm river
 */
export function heaveAt(time: number, lively: number) {
  return (
    lively * (0.018 * Math.sin(time * 1.7) + 0.009 * Math.sin(time * 2.9 + 1))
  );
}

/**
 * The roll of a hull on small ripples at a moment, in radians.
 *
 * @param time - The water's time, in seconds
 * @param lively - How lively the water is: 1 for a calm river
 */
export function rollAt(time: number, lively: number) {
  return (
    lively * (0.03 * Math.sin(time * 1.3 + 0.4) + 0.012 * Math.sin(time * 2.3))
  );
}
