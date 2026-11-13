import { Schema } from "effect";

/**
 * One steel bolt, M10 by 50 mm, and the quantities measured or derived from
 * it. Its length and diameter are lengths, [L]; the cross-section of its
 * shank is an area, [L]^2; the shank's volume is [L]^3; its mass is [M]; and
 * its density, mass over volume, is [M][L]^-3. The shank is taken as a plain
 * cylinder and the head is left out, so the mass is the shank's.
 */

/** The shank's length, in millimetres. */
export const SHANK_LENGTH = 50;

/** The shank's diameter, in millimetres. */
export const SHANK_DIAMETER = 10;

/** The density of steel, in kilograms per cubic metre. */
export const STEEL_DENSITY = 7850;

/** The quantities the lab shows. */
export const BoltQuantitySchema = Schema.Literals([
  "length",
  "diameter",
  "area",
  "volume",
  "mass",
  "density",
]);

/** Each quantity's value in SI units, and its powers of [M] and [L]. */
export function boltQuantities() {
  const area = (Math.PI * (SHANK_DIAMETER / 1000) ** 2) / 4;
  const volume = area * (SHANK_LENGTH / 1000);
  return {
    area: { length: 2, mass: 0, value: area },
    density: { length: -3, mass: 1, value: STEEL_DENSITY },
    diameter: { length: 1, mass: 0, value: SHANK_DIAMETER / 1000 },
    length: { length: 1, mass: 0, value: SHANK_LENGTH / 1000 },
    mass: { length: 0, mass: 1, value: STEEL_DENSITY * volume },
    volume: { length: 3, mass: 0, value: volume },
  } as const;
}
