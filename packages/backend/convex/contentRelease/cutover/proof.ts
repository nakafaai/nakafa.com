import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { requireAudioWorkflowCleanupCheckpoint } from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import {
  type AuditTableName,
  CURRENT_INVENTORY,
  CUTOVER_INVENTORY_VERSION,
  EXPECTED_CURRENT_DELETIONS,
  EXPECTED_LEGACY_DELETIONS,
  LEGACY_INVENTORY,
  RETAINED_ARTIFACT_COUNT,
  RETAINED_ATTEMPT_COUNT,
  RETAINED_CATALOG_COUNT,
  RETAINED_FROZEN_PLACEMENT_COUNT,
  RETAINED_PLACEMENT_COUNT,
  RETAINED_PROGRESS_COUNT,
  RETAINED_TRYOUT_RELEASES,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import {
  type CutoverProofReceipt,
  type HistoryProof,
  proofReceiptValidator,
  type RetentionFacts,
} from "@repo/backend/convex/contentRelease/cutover/proofState";
import { countAuditedTable } from "@repo/backend/convex/contentRelease/cutover/scan";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { Context, Effect } from "effect";

const historyProofReference = makeFunctionReference<
  "query",
  Record<string, never>,
  HistoryProof
>("tryouts/history/readiness:read");
const retentionFactsReference = makeFunctionReference<
  "query",
  Record<string, never>,
  RetentionFacts
>("contentRelease/cutover/proofState:retentionFacts");
const recordProofReference = makeFunctionReference<
  "mutation",
  CutoverProofReceipt,
  null
>("contentRelease/cutover/proofState:record");
const verifyArtifactsReference = makeFunctionReference<
  "action",
  Record<string, never>,
  { artifacts: number; placements: number }
>("contentRelease/cutover/artifacts:verify");

export interface CutoverProofEvidenceService {
  readonly authenticateArtifacts: () => Effect.Effect<
    { artifacts: number; placements: number },
    ReleaseError
  >;
  readonly countTable: (
    table: AuditTableName
  ) => Effect.Effect<number, ReleaseError>;
  readonly readHistory: () => Effect.Effect<HistoryProof, ReleaseError>;
  readonly readRetention: () => Effect.Effect<RetentionFacts, ReleaseError>;
  readonly record: (
    receipt: CutoverProofReceipt
  ) => Effect.Effect<null, ReleaseError>;
}

/** Cross-runtime operations used only by the terminal cutover proof. */
export class CutoverProofEvidence extends Context.Tag(
  "@repo/backend/contentRelease/CutoverProofEvidence"
)<CutoverProofEvidence, CutoverProofEvidenceService>() {}

/** Binds the final proof program to its private Convex functions. */
export function makeLiveProofEvidence(
  ctx: ActionCtx
): CutoverProofEvidenceService {
  return {
    authenticateArtifacts: () =>
      callInternal(() => ctx.runAction(verifyArtifactsReference, {})),
    countTable: (table) => countAuditedTable(ctx, table),
    readHistory: () =>
      callInternal(() => ctx.runQuery(historyProofReference, {})),
    readRetention: () =>
      callInternal(() => ctx.runQuery(retentionFactsReference, {})),
    record: (receipt) =>
      callInternal(() => ctx.runMutation(recordProofReference, receipt)),
  };
}

/** Proves exact zeros and the narrow immutable retained-history inventory. */
export const proof = internalAction({
  args: {},
  returns: proofReceiptValidator,
  handler: (ctx) =>
    runConvexActionProgram(
      proofProgram().pipe(
        Effect.provideService(CutoverProofEvidence, makeLiveProofEvidence(ctx))
      )
    ),
});

export const proofProgram = Effect.fn("contentRelease.cutover.proof")(
  function* () {
    const evidence = yield* CutoverProofEvidence;
    for (const entry of [...LEGACY_INVENTORY, ...CURRENT_INVENTORY]) {
      const count = yield* evidence.countTable(entry.table);
      if (count !== 0) {
        return yield* proofFailure(
          `${entry.table} still contains ${count} rows.`
        );
      }
    }
    const artifacts = yield* evidence.authenticateArtifacts();
    const storedArtifactCount = yield* evidence.countTable("contentArtifacts");
    if (
      artifacts.artifacts !== RETAINED_ARTIFACT_COUNT ||
      storedArtifactCount !== RETAINED_ARTIFACT_COUNT
    ) {
      return yield* proofFailure(
        "Retained artifact count changed after drain."
      );
    }
    const history = yield* evidence.readHistory();
    yield* validateHistoryNumbers(history);
    const facts = yield* evidence.readRetention();
    yield* validateRetentionFacts(facts);
    const receipt = {
      artifacts: artifacts.artifacts,
      attempts: history.attempts,
      bundles: facts.bundles.length,
      catalogRows: history.catalogRows,
      complete: true as const,
      frozenPlacements: history.frozenPlacements,
      markers: history.markers,
      placementRows: history.placementRows,
      progressRows: history.progressRows,
      snapshotId: history.snapshotId,
      snapshots: facts.snapshots.length,
    } satisfies CutoverProofReceipt;
    yield* evidence.record(receipt);
    return receipt;
  }
);

/** Rejects any weakened history-only proof shape. */
const validateHistoryNumbers = Effect.fn(
  "contentRelease.cutover.validateHistoryNumbers"
)(function* (history: HistoryProof) {
  if (
    history.attempts !== RETAINED_ATTEMPT_COUNT ||
    history.catalogRows !== RETAINED_CATALOG_COUNT ||
    history.frozenPlacements !== RETAINED_FROZEN_PLACEMENT_COUNT ||
    history.markers !== RETAINED_ATTEMPT_COUNT ||
    history.placementRows !== RETAINED_PLACEMENT_COUNT ||
    history.progressRows !== RETAINED_PROGRESS_COUNT ||
    history.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID
  ) {
    return yield* proofFailure(
      "History-only proof differs from the production inventory."
    );
  }
});

/** Requires exactly one snapshot and two known bundles after drain. */
const validateRetentionFacts = Effect.fn(
  "contentRelease.cutover.validateRetentionFacts"
)(function* (facts: RetentionFacts) {
  const releaseIds = new Set<string>(
    RETAINED_TRYOUT_RELEASES.map(({ releaseId }) => releaseId)
  );
  const manifests = new Map<string, string>(
    RETAINED_TRYOUT_RELEASES.map(({ manifestHash, releaseId }) => [
      releaseId,
      manifestHash,
    ])
  );
  const cutover = facts.cutover;
  if (cutover) {
    yield* requireAudioWorkflowCleanupCheckpoint({
      audit: cutover.audioWorkflowAudit,
      auditedAt: cutover.audioWorkflowAuditedAt,
      cleanedAt: cutover.audioWorkflowCleanedAt,
    });
  }
  if (
    facts.activityCount !== 1 ||
    !facts.activity ||
    facts.contentState !== 0 ||
    facts.cutoverCount !== 1 ||
    !cutover ||
    facts.activity.version !== cutover.auditedLegacyWriteVersion ||
    (cutover.phase !== "complete" && cutover.phase !== "proved") ||
    cutover.inventoryVersion !== CUTOVER_INVENTORY_VERSION ||
    cutover.frozenAt === undefined ||
    cutover.legacyDeleted !== EXPECTED_LEGACY_DELETIONS ||
    cutover.legacyTableDeleted !== 0 ||
    cutover.legacyTableIndex !== LEGACY_INVENTORY.length ||
    cutover.currentDeleted !== EXPECTED_CURRENT_DELETIONS ||
    cutover.currentTableDeleted !== 0 ||
    cutover.currentTableIndex !== CURRENT_INVENTORY.length + 2 ||
    cutover.currentTablePreserved !== 0 ||
    cutover.currentCursor !== undefined ||
    facts.snapshots.length !== 1 ||
    facts.snapshots[0]?.family !== "tryout" ||
    facts.snapshots[0].snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID ||
    facts.bundles.length !== RETAINED_TRYOUT_RELEASES.length ||
    facts.bundles.some(
      (bundle) =>
        bundle.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID ||
        !releaseIds.has(bundle.releaseId) ||
        bundle.manifestHash !== manifests.get(bundle.releaseId)
    )
  ) {
    return yield* proofFailure(
      "Retained snapshot or bundles changed after drain."
    );
  }
});

function proofFailure(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", `Cutover proof: ${message}`);
}
