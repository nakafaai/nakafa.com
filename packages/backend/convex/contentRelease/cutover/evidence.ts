import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { RETIRED_PROGRAM_ZERO_RECEIPT_VERSION } from "@repo/backend/convex/contentRelease/cutover/schema";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";

export const CUTOVER_REFERENCE_PROOF_COUNTS = {
  article: 14,
  material: 766,
  materialTopic: 72,
  quran: 228,
  tryout: 54,
} as const;

/** Authenticates every durable receipt required to retire the checkpoint. */
export function hasTerminalCutoverEvidence(
  checkpoint: Doc<"contentCutoverState">
) {
  const provedAt = checkpoint.provedAt;
  const reader = checkpoint.readerCutoverReceipt;
  const audio = checkpoint.audioWorkflowAudit;
  const retired = checkpoint.retiredProgramZeroReceipt;
  if (
    provedAt === undefined ||
    !reader ||
    reader.acceptedAt > provedAt ||
    !audio ||
    checkpoint.audioWorkflowAuditedAt === undefined ||
    checkpoint.audioWorkflowCleanedAt === undefined ||
    checkpoint.audioWorkflowAuditedAt > checkpoint.audioWorkflowCleanedAt ||
    checkpoint.audioWorkflowCleanedAt > provedAt ||
    !retired ||
    retired.version !== RETIRED_PROGRAM_ZERO_RECEIPT_VERSION ||
    !hasExactHistoryReceipt(reader.history) ||
    !hasExactAudioReceipt(audio) ||
    !hasExactReferenceReceipts(checkpoint, provedAt)
  ) {
    return false;
  }
  return sameReferenceCounts(
    reader.referenceProofs,
    CUTOVER_REFERENCE_PROOF_COUNTS
  );
}

function hasExactHistoryReceipt(
  history: NonNullable<
    Doc<"contentCutoverState">["readerCutoverReceipt"]
  >["history"]
) {
  const plan = retainedTryoutHistoryPlan;
  return (
    history.attempts === plan.attemptCount &&
    history.declaredFrozenPlacements === plan.frozenPlacementCount &&
    history.markers === plan.attemptCount &&
    history.snapshotId === plan.snapshotId &&
    history.releases.length === plan.releases.length &&
    history.releases.every((release, index) => {
      const expected = plan.releases[index];
      return (
        expected !== undefined &&
        release.attempts === expected.attemptCount &&
        release.releaseId === expected.releaseId
      );
    })
  );
}

function hasExactAudioReceipt(
  audio: NonNullable<Doc<"contentCutoverState">["audioWorkflowAudit"]>
) {
  const ids = new Set(audio.workflows.map((workflow) => workflow.id));
  const succeeded = audio.workflows.filter(
    (workflow) => workflow.result === "success"
  ).length;
  const failed = audio.workflows.length - succeeded;
  const steps = audio.workflows.reduce(
    (total, workflow) => total + workflow.steps,
    0
  );
  return (
    audio.total === 63 &&
    audio.succeeded === 37 &&
    audio.failed === 26 &&
    audio.steps === 315 &&
    audio.workflows.length === audio.total &&
    ids.size === audio.total &&
    succeeded === audio.succeeded &&
    failed === audio.failed &&
    steps === audio.steps
  );
}

function hasExactReferenceReceipts(
  checkpoint: Doc<"contentCutoverState">,
  provedAt: number
) {
  return (
    hasExactReferenceProof(
      checkpoint.articleReferenceProof,
      CUTOVER_REFERENCE_PROOF_COUNTS.article,
      provedAt
    ) &&
    hasExactReferenceProof(
      checkpoint.materialReferenceProof,
      CUTOVER_REFERENCE_PROOF_COUNTS.material,
      provedAt
    ) &&
    hasExactReferenceProof(
      checkpoint.materialTopicReferenceProof,
      CUTOVER_REFERENCE_PROOF_COUNTS.materialTopic,
      provedAt
    ) &&
    hasExactReferenceProof(
      checkpoint.quranReferenceProof,
      CUTOVER_REFERENCE_PROOF_COUNTS.quran,
      provedAt
    ) &&
    hasExactReferenceProof(
      checkpoint.tryoutReferenceProof,
      CUTOVER_REFERENCE_PROOF_COUNTS.tryout,
      provedAt
    )
  );
}

function hasExactReferenceProof(
  receipt: { readonly count: number; readonly provedAt: number } | undefined,
  expected: number,
  terminalProvedAt: number
) {
  return (
    receipt !== undefined &&
    receipt.count === expected &&
    receipt.provedAt <= terminalProvedAt
  );
}

function sameReferenceCounts(
  left: Readonly<Record<keyof typeof CUTOVER_REFERENCE_PROOF_COUNTS, number>>,
  right: Readonly<Record<keyof typeof CUTOVER_REFERENCE_PROOF_COUNTS, number>>
) {
  return (
    left.article === right.article &&
    left.material === right.material &&
    left.materialTopic === right.materialTopic &&
    left.quran === right.quran &&
    left.tryout === right.tryout
  );
}
