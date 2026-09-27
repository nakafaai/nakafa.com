import { Schema } from "effect";
/** Stable failure categories retained after terminal workflow cleanup. */
export const proofFailureValidator = Schema.Literals(["canceled", "failed"]);

/** Private workflow state returned to the authenticated HTTP action. */
export const proofPollValidator = Schema.Union([
  Schema.Struct({
    phase: Schema.Literal("verifying"),
  }),
  Schema.Struct({
    phase: Schema.Literal("verified"),
    proofJson: Schema.String,
  }),
  Schema.Struct({
    phase: Schema.Literal("failed"),
    reason: proofFailureValidator,
  }),
]);
