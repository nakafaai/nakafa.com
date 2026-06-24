import { Schema } from "effect";

/** CAS verification status values accepted by MathWork computation evidence. */
export const mathStatusValues = [
  "verified",
  "contradicted",
  "inconclusive",
] as const;

/** CAS derivation availability values accepted by MathWork computation evidence. */
export const mathStepStatusValues = [
  "complete",
  "partial",
  "unavailable",
] as const;

/** Schema for CAS result verification status inside MathWork computation rows. */
export const MathStatusSchema = Schema.Literal(...mathStatusValues).annotations(
  {
    description:
      "Verification status for the deterministic math result: verified, contradicted, or inconclusive.",
  }
);

/** Schema for CAS derivation availability inside MathWork computation rows. */
export const MathStepStatusSchema = Schema.Literal(
  ...mathStepStatusValues
).annotations({
  description:
    "Whether the verified math evidence includes complete, partial, or unavailable derivation steps.",
});

export type MathStatus = Schema.Schema.Type<typeof MathStatusSchema>;
export type MathStepStatus = Schema.Schema.Type<typeof MathStepStatusSchema>;
