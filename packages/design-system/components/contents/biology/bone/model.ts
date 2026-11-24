import { Match, Schema } from "effect";

export const BoneConditionSchema = Schema.Literals([
  "osteoporosis",
  "osteomalacia",
  "rickets",
  "arthritis",
  "scoliosis",
]);
export type BoneCondition = typeof BoneConditionSchema.Type;

export const HealthStateSchema = Schema.Literals(["healthy", "affected"]);
export type HealthState = typeof HealthStateSchema.Type;

export const BonePartSchema = Schema.Literals([
  "spongy",
  "mineral",
  "cartilage",
  "membrane",
  "spine",
  "growth",
]);
export type BonePart = typeof BonePartSchema.Type;

const LensFocusSchema = Schema.Struct({
  part: BonePartSchema,
  secondary: BonePartSchema,
  y: Schema.Finite,
});
export type LensFocus = typeof LensFocusSchema.Type;

/**
 * Maps each skeletal disorder to its anatomical focus height on the skeleton
 * and the primary tissue structures magnified inside the diagnostic lens.
 */
export function focusOf(condition: BoneCondition): LensFocus {
  return Match.value(condition).pipe(
    Match.when("osteoporosis", () => ({
      part: "spongy" as const,
      secondary: "mineral" as const,
      y: 0.78,
    })),
    Match.when("osteomalacia", () => ({
      part: "mineral" as const,
      secondary: "spongy" as const,
      y: 0.56,
    })),
    Match.when("rickets", () => ({
      part: "growth" as const,
      secondary: "mineral" as const,
      y: 0.42,
    })),
    Match.when("arthritis", () => ({
      part: "cartilage" as const,
      secondary: "membrane" as const,
      y: 0.46,
    })),
    Match.when("scoliosis", () => ({
      part: "spine" as const,
      secondary: "spongy" as const,
      y: 1.02,
    })),
    Match.exhaustive
  );
}
