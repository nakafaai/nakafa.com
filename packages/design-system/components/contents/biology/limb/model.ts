import { Match, Schema } from "effect";

const LimbKindSchema = Schema.Literals(["arm", "leg"]);
export type LimbKind = typeof LimbKindSchema.Type;

const LegMovementSchema = Schema.Literals([
  "heel",
  "toes",
  "bend",
  "straighten",
]);
export type LegMovement = typeof LegMovementSchema.Type;

const MuscleIdSchema = Schema.Literals([
  "biceps",
  "triceps",
  "quadriceps",
  "hamstrings",
  "gastrocnemius",
  "tibialis",
]);
export type MuscleId = typeof MuscleIdSchema.Type;

const LimbPartSchema = Schema.Literals([
  "humerus",
  "radius",
  "ulna",
  "femur",
  "tibia",
  "tendon",
]);
export type LimbPart = typeof LimbPartSchema.Type;

const AntagonisticPairSchema = Schema.Struct({
  contracting: MuscleIdSchema,
  relaxing: MuscleIdSchema,
});
type AntagonisticPair = typeof AntagonisticPairSchema.Type;

export const ARM_ANGLE_MIN = 35;
export const ARM_ANGLE_MAX = 170;
export const ARM_ANGLE_DEFAULT = 75;

/** Identifies the contracting and relaxing muscles for an elbow angle in degrees. */
export function armPairAt(angleDeg: number): AntagonisticPair {
  if (angleDeg < 105) {
    return { contracting: "biceps", relaxing: "triceps" };
  }
  return { contracting: "triceps", relaxing: "biceps" };
}

/** Identifies the contracting and relaxing muscles for one knee or ankle movement. */
export function legPairFor(movement: LegMovement): AntagonisticPair {
  return Match.value(movement).pipe(
    Match.when("heel", () => ({
      contracting: "gastrocnemius" as const,
      relaxing: "tibialis" as const,
    })),
    Match.when("toes", () => ({
      contracting: "tibialis" as const,
      relaxing: "gastrocnemius" as const,
    })),
    Match.when("bend", () => ({
      contracting: "hamstrings" as const,
      relaxing: "quadriceps" as const,
    })),
    Match.when("straighten", () => ({
      contracting: "quadriceps" as const,
      relaxing: "hamstrings" as const,
    })),
    Match.exhaustive
  );
}
