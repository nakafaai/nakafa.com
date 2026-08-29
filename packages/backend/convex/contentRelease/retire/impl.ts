import { canonicalizeSignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import {
  TryoutHistoryMigrationProofSchema,
  verifyTryoutHistoryMigrationProof,
} from "@nakafa/aksara-contracts/migration/tryout/history/proof";
import { verifySignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/verify";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { requireUnusedPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import {
  deletePredecessorRows,
  loadPredecessorRows,
  requireOwnedPredecessorRows,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import { decodePredecessorObservationId } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  deleteLegacyBundles,
  loadLegacyBundles,
  verifyLegacyBundleSet,
} from "@repo/backend/convex/contentRelease/retire/legacy";
import {
  type RetirementRuntimeContract,
  requirePermanentAttemptOwnership,
  retirementRuntimeContract,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import {
  countScaleRepairRows,
  matchesScaleRepair,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { Clock, Effect, Schema } from "effect";

const retirementEvidence = {
  assetHash:
    "sha256:2e0e31ea0733fc7945d9e05c91d9e012c477ce7fb5bd958245e744ae4eab14ba",
  receiptHash:
    "sha256:42e30eff6c16e14ba86bb44ff85be2b621fab1b2749440e647d7b71a67b47649",
  sourceSha: "5ff4bbffe406ea020a741ffa794bc4ff5d9353e0",
} as const;

/** Authenticates the immutable receipt and its exact published asset digest. */
const authenticateReceipt = Effect.fn("contentRelease.retire.authenticate")(
  function* (receiptJson: string, proofInput: unknown) {
    const parsed = yield* parseStoredJson(
      receiptJson,
      "Try-out history retirement receipt"
    );
    const receipt = yield* verifySignedTryoutHistoryMigrationReceipt(
      parsed
    ).pipe(Effect.mapError(contractFailure));
    if (
      canonicalizeSignedTryoutHistoryMigrationReceipt(receipt) !== receiptJson
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history retirement receipt is not canonical."
      );
    }
    const proof = yield* Schema.decodeUnknownEffect(
      TryoutHistoryMigrationProofSchema,
      { onExcessProperty: "error" }
    )(proofInput).pipe(Effect.mapError(contractFailure));
    yield* verifyTryoutHistoryMigrationProof(receipt, proof).pipe(
      Effect.mapError(contractFailure)
    );
    if (
      receipt.payload.migrationId !== retainedScaleRepair.migrationId ||
      receipt.payload.planHash !== retainedScaleRepair.planHash ||
      receipt.payload.sourceSnapshotId !==
        retainedScaleRepair.sourceSnapshotId ||
      receipt.receiptHash !== retirementEvidence.receiptHash ||
      proof.assetHash !== retirementEvidence.assetHash ||
      proof.sourceSha !== retirementEvidence.sourceSha
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history retirement proof does not identify the retained migration."
      );
    }
    return { proof, receipt };
  }
);

/** Reads every temporary table before the final destructive transaction. */
const loadTemporaryState = Effect.fn("contentRelease.retire.loadState")(
  function* (ctx: MutationCtx) {
    return yield* Effect.all({
      abort: Effect.promise(() =>
        ctx.db.query("tryoutHistoryMigrationAborts").first()
      ),
      audit: Effect.promise(() =>
        ctx.db.query("tryoutHistoryAttemptMigrationAudits").first()
      ),
      history: Effect.promise(() => ctx.db.query("tryoutHistoryRows").first()),
      map: Effect.promise(() =>
        ctx.db.query("tryoutHistoryMigrationMaps").first()
      ),
      marker: Effect.promise(() =>
        ctx.db.query("tryoutAttemptHistory").first()
      ),
      receipt: Effect.promise(() =>
        ctx.db.query("tryoutHistoryMigrationReceipts").take(2)
      ),
      root: Effect.promise(() =>
        ctx.db.query("tryoutHistoryMigrations").first()
      ),
      scale: Effect.promise(() =>
        ctx.db.query("tryoutHistoryScaleMigrations").first()
      ),
    });
  }
);

function hasSameProof(
  left: { readonly assetHash: string; readonly sourceSha: string },
  right: { readonly assetHash: string; readonly sourceSha: string }
) {
  return (
    left.assetHash === right.assetHash && left.sourceSha === right.sourceSha
  );
}

/** Deletes the final receipt and unused observer only after all proofs agree. */
export const retireRuntimeState = Effect.fn("contentRelease.retire")(function* (
  ctx: MutationCtx,
  observationInput: string,
  receiptJson: string,
  proofInput: unknown,
  runtimeProofHash: string,
  runtimeContract: RetirementRuntimeContract = retirementRuntimeContract
) {
  const observationId = yield* decodePredecessorObservationId(observationInput);
  const { proof, receipt } = yield* authenticateReceipt(
    receiptJson,
    proofInput
  );
  const state = yield* loadTemporaryState(ctx);
  if (
    state.abort !== null ||
    state.audit !== null ||
    state.history !== null ||
    state.map !== null ||
    state.marker !== null ||
    state.root !== null ||
    state.scale !== null
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history retirement found temporary migration rows."
    );
  }
  const rows = yield* loadPredecessorRows(ctx);
  const permanentAttempts = yield* requirePermanentAttemptOwnership(
    ctx,
    runtimeProofHash,
    runtimeContract
  );
  const legacyBundles = yield* loadLegacyBundles(ctx, runtimeContract);
  const stored = state.receipt[0] ?? null;
  if (!stored) {
    if (
      state.receipt.length !== 0 ||
      Object.values(rows).some((row) => row !== null) ||
      legacyBundles.length !== 0
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Runtime retirement retained only part of its terminal state."
      );
    }
    return {
      deleted: 0,
      deletedLegacyBundles: 0,
      migrationId: receipt.payload.migrationId,
      observationId,
      permanentAttempts,
      receiptHash: receipt.receiptHash,
      retiredAt: yield* Clock.currentTimeMillis,
    } as const;
  }
  const completion = receipt.payload.completion;
  if (
    state.receipt.length !== 1 ||
    stored.phase !== "cleaned" ||
    stored.cleanupLimit !== completion.cleanupLimit ||
    stored.completedAt !== completion.completedAt ||
    stored.migratedAttempts !== completion.migratedAttempts ||
    stored.migratedScaleItems !== completion.migratedScaleItems ||
    stored.migratedScaleRuns !== completion.migratedScaleRuns ||
    stored.migratedScaleVersions !== completion.migratedScaleVersions ||
    stored.migrationId !== receipt.payload.migrationId ||
    stored.planHash !== receipt.payload.planHash ||
    stored.receiptHash !== receipt.receiptHash ||
    stored.receiptJson !== receiptJson ||
    stored.sourceSnapshotId !== receipt.payload.sourceSnapshotId ||
    stored.targetBundleHash !== receipt.payload.targetBundleHash ||
    stored.targetSnapshotId !== receipt.payload.targetSnapshotId ||
    !Number.isSafeInteger(stored.deletedRows) ||
    stored.deletedRows <= 0 ||
    stored.deletedRows > stored.cleanupLimit ||
    stored.proof === undefined ||
    !hasSameProof(stored.proof, proof) ||
    stored.repair === undefined ||
    !matchesScaleRepair(
      stored.repair,
      retainedScaleRepair,
      countScaleRepairRows(retainedScaleRepair)
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history retirement lost its authenticated cleanup proof."
    );
  }
  const retainedLegacyBundles = yield* verifyLegacyBundleSet(
    legacyBundles,
    runtimeContract
  );
  yield* requireUnusedPredecessorObservation(ctx, observationId);
  const ownedRows = yield* requireOwnedPredecessorRows(rows, observationId);
  yield* deletePredecessorRows(ctx, ownedRows);
  const deletedLegacyBundles = yield* deleteLegacyBundles(
    ctx,
    retainedLegacyBundles
  );
  yield* Effect.promise(() => ctx.db.delete(stored._id));
  return {
    deleted: 5 + deletedLegacyBundles,
    deletedLegacyBundles,
    migrationId: receipt.payload.migrationId,
    observationId,
    permanentAttempts,
    receiptHash: receipt.receiptHash,
    retiredAt: yield* Clock.currentTimeMillis,
  } as const;
});
