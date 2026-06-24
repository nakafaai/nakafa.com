import { Schema } from "effect";

/** Verification lanes allowed on answers, steps, notes, and artifacts. */
export const verificationLaneValues = [
  "verified",
  "derived",
  "pedagogical",
  "speculative",
] as const;

/** Trust labels that distinguish checked math from teaching-only projection. */
export const VerificationLaneSchema = Schema.Literal(
  ...verificationLaneValues
).annotations({
  description: "Trust lane for a MathWork answer, step, or artifact.",
});

export type VerificationLane = Schema.Schema.Type<
  typeof VerificationLaneSchema
>;

/** Projection levels supported by semantic MathWork derivation steps. */
export const stepProjectionLevelValues = [
  "atomic",
  "school",
  "advanced",
  "professor",
] as const;

/** Detail levels available when projecting one semantic derivation step. */
export const StepProjectionLevelSchema = Schema.Literal(
  ...stepProjectionLevelValues
).annotations({
  description: "Projection levels available for a MathWorkStep.",
});

export type StepProjectionLevel = Schema.Schema.Type<
  typeof StepProjectionLevelSchema
>;
