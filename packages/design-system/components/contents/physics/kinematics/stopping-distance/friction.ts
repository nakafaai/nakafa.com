import { Array as Arr, Schema } from "effect";

/** The road surfaces a learner can brake on. */
export const SurfaceSchema = Schema.Literals([
  "dry",
  "wet",
  "gravel",
  "snow",
  "ice",
]);
export type Surface = typeof SurfaceSchema.Type;

/** Every surface, in the order the toolbar lists them. */
export const SURFACES = SurfaceSchema.literals;

/**
 * The gravitational field strength the lesson uses, in m/s².
 */
export const GRAVITY = 9.8;

/**
 * The sliding (locked wheel) friction coefficient of a car tyre on each
 * surface, from Table 1 of Soica and Gheorghe, "Tire–Road
 * Interaction: A Comprehensive Review of Friction Mechanisms, Influencing
 * Factors, and Future Challenges", Machines 13 (2025) 1005,
 * https://doi.org/10.3390/machines13111005. The table gives wet asphalt as a
 * range, 0.45 to 0.6, and the lab takes its lower end, the grip a careful
 * driver plans for.
 */
const SLIDING_FRICTION = {
  dry: 0.75,
  gravel: 0.55,
  ice: 0.07,
  snow: 0.15,
  wet: 0.45,
} satisfies Record<Surface, number>;

/** The sliding friction coefficient of a tyre on `surface`. */
export function frictionOf(surface: Surface) {
  return SLIDING_FRICTION[surface];
}

/**
 * The deceleration of a car whose locked tyres slide on `surface`: friction
 * is the only horizontal force, so m·b = μ·m·g and b = μ·g.
 */
export function decelerationOf(surface: Surface) {
  return frictionOf(surface) * GRAVITY;
}

/** Whether a learner picked one of the lab's surfaces. */
export function isSurface(value: string): value is Surface {
  return Arr.contains(SURFACES, value);
}
