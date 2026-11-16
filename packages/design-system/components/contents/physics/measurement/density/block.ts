import { Schema } from "effect";

/**
 * Three blocks cut to the same size, 5.0 cm by 4.0 cm by 2.5 cm, from pine,
 * aluminium and brass. A ruler gives three lengths and a balance one mass:
 * four readings of base quantities. Their volume and density are derived:
 * the volume from three lengths, the density from mass over volume.
 */

/** The block's sides, in centimetres. */
export const BLOCK_SIDES = { height: 2.5, length: 5, width: 4 } as const;

/** The materials, by their density in grams per cubic centimetre. */
export const MaterialSchema = Schema.Literals(["pine", "aluminium", "brass"]);
const DENSITIES = {
  aluminium: 2.7,
  brass: 8.5,
  pine: 0.5,
} as const satisfies Record<typeof MaterialSchema.Type, number>;

/** The block's volume in cubic centimetres, its mass in grams, and its density in both units. */
export function blockReading(material: typeof MaterialSchema.Type) {
  const volume = BLOCK_SIDES.length * BLOCK_SIDES.width * BLOCK_SIDES.height;
  const mass = volume * DENSITIES[material];
  const density = mass / volume;
  return { density, densitySi: density * 1000, mass, volume };
}
