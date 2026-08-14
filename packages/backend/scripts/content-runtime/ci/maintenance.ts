import {
  CUTOVER_AUDIO_WORKFLOW_COUNTS,
  CUTOVER_REFERENCE_PROOF_COUNTS,
} from "@repo/backend/convex/contentRelease/cutover/evidence";
import { RETIRED_PROGRAM_ZERO_RECEIPT_VERSION } from "@repo/backend/convex/contentRelease/cutover/schema";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect, Schema } from "effect";
import { contentRuntimeCiError } from "./error";
import {
  type JsonObject,
  JsonValueSchema,
  stripConvexSystemFields,
} from "./json";

const TimestampSchema = Schema.Number.pipe(Schema.int(), Schema.positive());

const ReferenceProofSchema = Schema.Struct({
  count: Schema.NonNegativeInt,
  provedAt: TimestampSchema,
});

const AudioWorkflowSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  result: Schema.Literal("failed", "success"),
  steps: Schema.Literal(5),
});

const ProvedMaintenanceCheckpointSchema = Schema.Struct({
  articleReferenceProof: ReferenceProofSchema,
  audioWorkflowAudit: Schema.Struct({
    failed: Schema.Literal(CUTOVER_AUDIO_WORKFLOW_COUNTS.failed),
    steps: Schema.Literal(CUTOVER_AUDIO_WORKFLOW_COUNTS.steps),
    succeeded: Schema.Literal(CUTOVER_AUDIO_WORKFLOW_COUNTS.succeeded),
    total: Schema.Literal(CUTOVER_AUDIO_WORKFLOW_COUNTS.total),
    workflows: Schema.Array(AudioWorkflowSchema),
  }),
  audioWorkflowAuditedAt: TimestampSchema,
  audioWorkflowCleanedAt: TimestampSchema,
  auditedActiveReleaseId: Schema.NonEmptyString,
  auditedActiveSequence: Schema.Literal(25),
  auditedAt: TimestampSchema,
  auditedLegacyWriteVersion: Schema.Literal(0),
  auditedNextSequence: Schema.Literal(27),
  currentCursor: Schema.optional(JsonValueSchema),
  currentDeleted: Schema.Literal(22_954),
  currentTableDeleted: Schema.Literal(0),
  currentTableIndex: Schema.Literal(24),
  currentTablePreserved: Schema.Literal(0),
  frozenAt: TimestampSchema,
  inventoryVersion: Schema.Literal("production-2026-08-13"),
  key: Schema.Literal("phase1"),
  legacyDeleted: Schema.Literal(12_854),
  legacyTableDeleted: Schema.Literal(0),
  legacyTableIndex: Schema.Literal(16),
  materialReferenceProgress: Schema.optional(JsonValueSchema),
  materialReferenceProof: ReferenceProofSchema,
  materialTopicReferenceProof: ReferenceProofSchema,
  phase: Schema.Literal("proved"),
  provedAt: TimestampSchema,
  quranReferenceProgress: Schema.optional(JsonValueSchema),
  quranReferenceProof: ReferenceProofSchema,
  readerCutoverReceipt: Schema.Struct({
    acceptedAt: TimestampSchema,
    history: Schema.Struct({
      attempts: Schema.NonNegativeInt,
      declaredFrozenPlacements: Schema.NonNegativeInt,
      markers: Schema.NonNegativeInt,
      releases: Schema.Array(
        Schema.Struct({
          attempts: Schema.NonNegativeInt,
          releaseId: Schema.NonEmptyString,
        })
      ),
      snapshotId: Schema.NonEmptyString,
    }),
    referenceProofs: Schema.Struct({
      article: Schema.NonNegativeInt,
      material: Schema.NonNegativeInt,
      materialTopic: Schema.NonNegativeInt,
      quran: Schema.NonNegativeInt,
      tryout: Schema.NonNegativeInt,
    }),
  }),
  retiredProgramZeroReceipt: Schema.Struct({
    learningPlanItems: Schema.Literal(0),
    learningPlans: Schema.Literal(0),
    learningProfiles: Schema.Literal(0),
    learningProgramCoverage: Schema.Literal(0),
    learningProgramSources: Schema.Literal(0),
    learningPrograms: Schema.Literal(0),
    version: Schema.Literal(RETIRED_PROGRAM_ZERO_RECEIPT_VERSION),
  }),
  tryoutReferenceProof: ReferenceProofSchema,
  updatedAt: TimestampSchema,
});

const ProvedMaintenanceActivitySchema = Schema.Struct({
  key: Schema.Literal("legacy"),
  updatedAt: TimestampSchema,
  version: Schema.Literal(0),
});

export interface ProvedMaintenanceInput {
  readonly contentCutoverActivity: readonly JsonObject[];
  readonly contentCutoverState: readonly JsonObject[];
  readonly contentState: readonly JsonObject[];
}

/** Authenticates the one temporary zero-publication production checkpoint. */
export const verifyProvedMaintenance = Effect.fn(
  "contentRuntime.verifyProvedMaintenance"
)(function* (input: ProvedMaintenanceInput) {
  const checkpointRow = input.contentCutoverState[0];
  const activityRow = input.contentCutoverActivity[0];
  if (
    input.contentState.length !== 0 ||
    input.contentCutoverState.length !== 1 ||
    input.contentCutoverActivity.length !== 1 ||
    !checkpointRow ||
    !activityRow
  ) {
    return yield* contentRuntimeCiError(
      "Production maintenance requires an empty pointer and exact checkpoint rows."
    );
  }

  const checkpoint = yield* decodeCheckpoint(checkpointRow);
  const activity = yield* decodeActivity(activityRow);
  if (
    checkpoint.currentCursor !== undefined ||
    checkpoint.materialReferenceProgress !== undefined ||
    checkpoint.quranReferenceProgress !== undefined
  ) {
    return yield* contentRuntimeCiError(
      "Production maintenance still contains an incomplete proof cursor."
    );
  }

  const expectedRelease = retainedTryoutHistoryPlan.releases.at(-1);
  if (
    expectedRelease === undefined ||
    checkpoint.auditedActiveReleaseId !== expectedRelease.releaseId ||
    activity.version !== checkpoint.auditedLegacyWriteVersion ||
    activity.updatedAt > checkpoint.auditedAt
  ) {
    return yield* contentRuntimeCiError(
      "Production maintenance identity does not match the terminal cutover."
    );
  }

  const receiptsAreComplete =
    hasExactHistoryReceipt(checkpoint.readerCutoverReceipt.history) &&
    hasExactReferenceReceipts(checkpoint) &&
    hasExactAudioReceipt(checkpoint.audioWorkflowAudit);
  if (!receiptsAreComplete) {
    return yield* contentRuntimeCiError(
      "Production maintenance receipts are incomplete."
    );
  }

  const receiptTimes = [
    checkpoint.readerCutoverReceipt.acceptedAt,
    checkpoint.articleReferenceProof.provedAt,
    checkpoint.materialReferenceProof.provedAt,
    checkpoint.materialTopicReferenceProof.provedAt,
    checkpoint.quranReferenceProof.provedAt,
    checkpoint.tryoutReferenceProof.provedAt,
  ];
  if (
    checkpoint.auditedAt > checkpoint.frozenAt ||
    checkpoint.frozenAt > checkpoint.provedAt ||
    checkpoint.updatedAt !== checkpoint.provedAt ||
    checkpoint.audioWorkflowAuditedAt > checkpoint.audioWorkflowCleanedAt ||
    checkpoint.audioWorkflowCleanedAt > checkpoint.provedAt ||
    receiptTimes.some((provedAt) => provedAt > checkpoint.provedAt)
  ) {
    return yield* contentRuntimeCiError(
      "Production maintenance receipt chronology is invalid."
    );
  }

  return input;
});

const decodeCheckpoint = (row: JsonObject) =>
  Schema.decodeUnknown(ProvedMaintenanceCheckpointSchema)(
    stripConvexSystemFields(row),
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(
        "Production maintenance checkpoint is not the terminal receipt."
      )
    )
  );

const decodeActivity = (row: JsonObject) =>
  Schema.decodeUnknown(ProvedMaintenanceActivitySchema)(
    stripConvexSystemFields(row),
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(
        "Production maintenance activity is not the terminal receipt."
      )
    )
  );

function hasExactHistoryReceipt(
  history: Schema.Schema.Type<
    typeof ProvedMaintenanceCheckpointSchema
  >["readerCutoverReceipt"]["history"]
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

function hasExactReferenceReceipts(
  checkpoint: Schema.Schema.Type<typeof ProvedMaintenanceCheckpointSchema>
) {
  const counts = CUTOVER_REFERENCE_PROOF_COUNTS;
  return (
    checkpoint.articleReferenceProof.count === counts.article &&
    checkpoint.materialReferenceProof.count === counts.material &&
    checkpoint.materialTopicReferenceProof.count === counts.materialTopic &&
    checkpoint.quranReferenceProof.count === counts.quran &&
    checkpoint.tryoutReferenceProof.count === counts.tryout &&
    checkpoint.readerCutoverReceipt.referenceProofs.article ===
      counts.article &&
    checkpoint.readerCutoverReceipt.referenceProofs.material ===
      counts.material &&
    checkpoint.readerCutoverReceipt.referenceProofs.materialTopic ===
      counts.materialTopic &&
    checkpoint.readerCutoverReceipt.referenceProofs.quran === counts.quran &&
    checkpoint.readerCutoverReceipt.referenceProofs.tryout === counts.tryout
  );
}

function hasExactAudioReceipt(
  audit: Schema.Schema.Type<
    typeof ProvedMaintenanceCheckpointSchema
  >["audioWorkflowAudit"]
) {
  const succeeded = audit.workflows.filter(
    (workflow) => workflow.result === "success"
  ).length;
  const failed = audit.workflows.length - succeeded;
  const steps = audit.workflows.reduce(
    (total, workflow) => total + workflow.steps,
    0
  );
  const uniqueIds = new Set(audit.workflows.map((workflow) => workflow.id));
  return (
    audit.workflows.length === CUTOVER_AUDIO_WORKFLOW_COUNTS.total &&
    uniqueIds.size === CUTOVER_AUDIO_WORKFLOW_COUNTS.total &&
    succeeded === CUTOVER_AUDIO_WORKFLOW_COUNTS.succeeded &&
    failed === CUTOVER_AUDIO_WORKFLOW_COUNTS.failed &&
    steps === CUTOVER_AUDIO_WORKFLOW_COUNTS.steps
  );
}
