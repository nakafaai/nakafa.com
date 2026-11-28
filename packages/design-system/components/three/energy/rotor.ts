import { Array as Arr } from "effect";

/**
 * The rotor of a three-bladed wind turbine: where it stands, how fast the
 * wind turns it, and the spinner that fairs its hub. Lengths are in rotor
 * radii.
 */

/** Where the rotor's hub stands above the foundation and how far upwind of the tower's axis, for a rotor of radius 1. */
export const ROTOR = { hub: 2, overhang: 0.15 } as const;

/** How many times faster than the wind a modern rotor's blade tips move. */
const TIP_SPEED_RATIO = 7;

/** The share of its speed the wind has lost by the time it reaches a rotor working at the Betz optimum. */
const INDUCTION = 1 / 3;

/**
 * How fast a rotor turns in a steady wind, in radians per second: its tips
 * run at seven times the wind speed, so a longer blade turns more slowly.
 *
 * @param wind - The wind speed, in metres per second
 * @param metres - The rotor's radius, in metres
 */
export function rotorRate(wind: number, metres: number) {
  return (TIP_SPEED_RATIO * wind) / metres;
}

/**
 * The share of the free wind's speed the air inside the rotor's stream tube
 * still has at a distance `downstream` of the rotor's plane, negative
 * upwind of it: all of it far upwind, two thirds at the rotor and a third
 * far behind, as the air gives its energy to the blades.
 */
export function windShare(downstream: number) {
  return (
    1 - INDUCTION * (1 + downstream / Math.sqrt(1 + downstream * downstream))
  );
}

/**
 * How far from the rotor's axis a parcel of air flows at a distance
 * `downstream` of the rotor's plane, when it crosses that plane at `radius`
 * from the axis. Slower air needs more room, so the stream tube through the
 * rotor widens behind it and pushes the air round it outward.
 */
export function streamRadius(radius: number, downstream: number) {
  const tube = Math.sqrt((1 - INDUCTION) / windShare(downstream));
  return radius < 1
    ? radius * tube
    : Math.sqrt(radius * radius - 1 + tube * tube);
}

/** How many points draw the spinner's nose. */
const NOSE_POINTS = 18;

/**
 * The spinner's outline from its skirt to its nose as radius and height
 * pairs, which a lathe turns into the fairing: a straight skirt back to the nacelle, then
 * a blunt ogive.
 *
 * @param radius - The spinner's radius at its skirt
 * @param length - The length of its nose
 */
export function spinnerProfile(radius: number, length: number) {
  const nose = Arr.makeBy(NOSE_POINTS + 1, (point) => {
    const share = point / NOSE_POINTS;
    return [radius * (1 - share * share) ** 0.6, share * length] as const;
  });
  return [[radius, -length * 0.75] as const, ...nose];
}
