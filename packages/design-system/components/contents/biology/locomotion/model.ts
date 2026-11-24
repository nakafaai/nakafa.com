import { Match, Schema } from "effect";

const LocomotionAnimalSchema = Schema.Literals([
  "earthworm",
  "fish",
  "grasshopper",
  "bird",
]);
export type LocomotionAnimal = typeof LocomotionAnimalSchema.Type;

const LocomotionMuscleSchema = Schema.Literals([
  "circular",
  "longitudinal",
  "left",
  "right",
  "extensor",
  "flexor",
  "pectoralis",
  "supracoracoideus",
]);
export type LocomotionMuscle = typeof LocomotionMuscleSchema.Type;

const LocomotionPartSchema = Schema.Literals([
  "chaetae",
  "fluid",
  "myotome",
  "fin",
  "femur",
  "tibia",
  "keel",
]);
export type LocomotionPart = typeof LocomotionPartSchema.Type;

/**
 * Identifies which antagonistic muscle is actively contracting at normalized
 * gait phase `phase` (0 to 1) for each of the four locomotion models.
 */
export function activeMuscleAt(
  animal: LocomotionAnimal,
  phase: number
): LocomotionMuscle {
  const firstHalf = ((phase % 1) + 1) % 1 < 0.5;
  return Match.value(animal).pipe(
    Match.when("earthworm", () => (firstHalf ? "circular" : "longitudinal")),
    Match.when("fish", () => (firstHalf ? "left" : "right")),
    Match.when("grasshopper", () => (firstHalf ? "flexor" : "extensor")),
    Match.when("bird", () => (firstHalf ? "pectoralis" : "supracoracoideus")),
    Match.exhaustive
  );
}
