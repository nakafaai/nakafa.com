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
