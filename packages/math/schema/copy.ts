import { mathOperations } from "@repo/math/schema/operations";
import { Schema } from "effect";

/** Static learner-copy keys that MathWork can request from app dictionaries. */
export const mathStaticCopyKeyValues = [
  "math-assumption-bound",
  "math-assumption-circle-radius-point",
  "math-assumption-points",
  "math-assumption-requirement",
  "math-assumption-variable",
  "math-assumption-variables",
  "math-error",
  "math-limitation-cas-inconclusive",
  "math-loading",
  "math-step",
  "math-step-apart",
  "math-step-cancel",
  "math-step-compare",
  "math-step-differentiate",
  "math-step-distance",
  "math-step-evaluate",
  "math-step-expand",
  "math-step-factor",
  "math-step-integrate",
  "math-step-integrate-sum",
  "math-step-integrate-symmetry",
  "math-step-rationalize",
  "math-step-simplify",
  "math-step-solve",
  "math-step-substitute",
  "math-step-together",
  "math-verification-derived",
  "math-verification-pedagogical",
  "math-verification-contradicted",
  "math-verification-speculative",
  "math-verification-verified",
  "math-visual-coordinate-circle-description",
  "math-visual-coordinate-line-description",
  "math-work-assumptions-title",
  "math-work-formula-title",
  "math-work-limitations-title",
  "math-work-steps-title",
  "math-work-visual-title",
] as const;

/** Interpolation value name that binds visible pedagogy copy to evidence. */
export const mathEvidenceRefValueName = "evidenceRef";

/** Operation title translation keys derived from the operation source list. */
export const mathOperationCopyKeyValues = mathOperations.map(
  (operation) => `math-${operation}` as const
);

/** Complete list of translation keys accepted by canonical MathWork contracts. */
export const mathCopyKeyValues = [
  ...mathStaticCopyKeyValues,
  ...mathOperationCopyKeyValues,
] as const;

/** Static MathReasoning translation keys that are not direct operation keys. */
export const MathStaticCopyKeySchema = Schema.Literal(
  ...mathStaticCopyKeyValues
);

/** Translation key for an operation title already owned by the Ai dictionary. */
export const MathOperationCopyKeySchema = Schema.Literal(
  ...mathOperationCopyKeyValues
);

/** Translation key accepted inside canonical MathWork projection metadata. */
export const MathCopyKeySchema = Schema.Union(
  MathStaticCopyKeySchema,
  MathOperationCopyKeySchema
);

/** Named interpolation value passed from MathWork to localized projections. */
export const MathCopyValueSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  value: Schema.String,
}).pipe(Schema.mutable);

export type MathCopyKey = Schema.Schema.Type<typeof MathCopyKeySchema>;
export type MathCopyValue = Schema.Schema.Type<typeof MathCopyValueSchema>;
