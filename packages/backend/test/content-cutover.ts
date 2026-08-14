import { AUDITED_REFERENCE_PROOF_COUNTS } from "@repo/backend/convex/contentRelease/cutover/inventory";
import type { ReferenceProofCounts } from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import {
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";

/** Exact production-shaped reader receipt for cutover-only test fixtures. */
export function testReaderCutoverReceipt(
  plan: RetainedTryoutHistoryPlan = retainedTryoutHistoryPlan,
  referenceProofs: ReferenceProofCounts = AUDITED_REFERENCE_PROOF_COUNTS,
  acceptedAt = 1
) {
  return {
    acceptedAt,
    history: {
      attempts: plan.attemptCount,
      catalogRows: plan.catalogRowCount,
      frozenPlacements: plan.frozenPlacementCount,
      markers: plan.attemptCount,
      placementRows: plan.placementRowCount,
      progressRows: plan.progressCount,
      snapshotId: plan.snapshotId,
    },
    referenceProofs,
  };
}
