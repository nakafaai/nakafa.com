import { ContentSnapshotStateSchema } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { snapshotFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/**
 * One replaced snapshot family proven on its own rows by its own durable step:
 * the transition its rows authenticate and how many rows it staged.
 */
export const familySnapshotProofValidator = Schema.Struct({
  family: snapshotFamilyValidator,
  stagedRows: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  state: ContentSnapshotStateSchema,
});
export type FamilySnapshotProof = typeof familySnapshotProofValidator.Type;
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

/** Read-only poll state; `pending` names the one case that must run the poll mutation. */
export const proofStatusValidator = Schema.Union([
  proofPollValidator,
  Schema.Struct({
    phase: Schema.Literal("pending"),
  }),
]);
