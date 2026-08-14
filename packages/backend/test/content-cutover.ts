import { AUDITED_REFERENCE_PROOF_COUNTS } from "@repo/backend/convex/contentRelease/cutover/inventory";
import type { ReferenceProofCounts } from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import {
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
  type TerminalHistoryProof,
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
      declaredFrozenPlacements: plan.frozenPlacementCount,
      markers: plan.attemptCount,
      releases: plan.releases.map((release) => ({
        attempts: release.attemptCount,
        releaseId: release.releaseId,
      })),
      snapshotId: plan.snapshotId,
    },
    referenceProofs,
  };
}

/** Exact terminal history receipt for cutover-only unit test boundaries. */
export function testTerminalHistoryProof(
  plan: RetainedTryoutHistoryPlan = retainedTryoutHistoryPlan
): TerminalHistoryProof {
  return {
    artifacts: plan.artifactCount,
    attempts: plan.attemptCount,
    bundles: plan.releases.length,
    catalogRows: plan.catalogRowCount,
    frozenPlacements: plan.frozenPlacementCount,
    markers: plan.attemptCount,
    placementRows: plan.placementRowCount,
    progressRows: plan.progressCount,
    snapshotId: plan.snapshotId,
  };
}
