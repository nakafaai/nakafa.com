import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Stable failure categories retained after terminal workflow cleanup. */
export const proofFailureValidator = literals("canceled", "failed");

/** Private workflow state returned to the authenticated HTTP action. */
export const proofPollValidator = v.union(
  v.object({ phase: v.literal("verifying") }),
  v.object({ phase: v.literal("verified"), proofJson: v.string() }),
  v.object({
    phase: v.literal("failed"),
    reason: proofFailureValidator,
  })
);
