import { Schema } from "effect";
export const MathStatusSchema = Schema.Literals([
  "verified",
  "contradicted",
  "inconclusive",
]).annotate({
  description:
    "Verification status for the deterministic math result: verified, contradicted, or inconclusive.",
});
export const MathStepStatusSchema = Schema.Literals([
  "complete",
  "partial",
  "unavailable",
]).annotate({
  description:
    "Whether the verified math evidence includes complete, partial, or unavailable derivation steps.",
});
export type MathStatus = Schema.Schema.Type<typeof MathStatusSchema>;
export type MathStepStatus = Schema.Schema.Type<typeof MathStepStatusSchema>;
