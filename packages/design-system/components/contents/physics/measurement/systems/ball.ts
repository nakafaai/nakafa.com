import { Schema } from "effect";

/**
 * A 16 lb bowling ball, the heaviest the rules allow, 8.5 in across, weighed
 * and measured in three unit systems. FPS counts feet and pounds, CGS
 * centimetres and grams, MKS metres and kilograms, and all three count
 * seconds. The ball does not change; only the numbers do.
 */

/** The ball's diameter, in metres: 8.5 inches. */
export const BALL_DIAMETER = 8.5 * 0.0254;

/** The ball's mass, in kilograms: 16 pounds. */
export const BALL_MASS = 16 * 0.453_592_37;

/** The unit systems, each with its length and mass unit in metres and kilograms. */
export const UnitSystemSchema = Schema.Literals(["fps", "cgs", "mks"]);
export const UNIT_SYSTEMS = {
  cgs: { length: 0.01, mass: 0.001 },
  fps: { length: 0.3048, mass: 0.453_592_37 },
  mks: { length: 1, mass: 1 },
} as const;

/** The ball's diameter and mass in `system`'s units. */
export function ballIn(system: typeof UnitSystemSchema.Type) {
  const units = UNIT_SYSTEMS[system];
  return { diameter: BALL_DIAMETER / units.length, mass: BALL_MASS / units.mass };
}
