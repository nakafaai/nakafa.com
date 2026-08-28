"use node";

import { canonicalizeSignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import {
  type TryoutHistoryMigrationProof,
  TryoutHistoryMigrationProofSchema,
} from "@nakafa/aksara-contracts/migration/tryout/history/proof";
import type { TryoutHistoryMigrationRequest } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { requireActiveContentKey } from "@repo/backend/convex/contentRelease/ingress/key";
import { hasRequiredScaleRepair } from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import type { cleanupResultValidator } from "@repo/backend/convex/tryouts/migration/cleanup/run";
import { verifyImmutableMigrationReceipt } from "@repo/backend/convex/tryouts/migration/proof/github";
import {
  authenticateMigrationReceipt,
  hasSameCompletedStatus,
} from "@repo/backend/convex/tryouts/migration/proof/receipt";
import type {
  cleanupReceiptValidator,
  migrationReceiptRecordValidator,
  migrationStatusValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import { readMigrationStatus } from "@repo/backend/convex/tryouts/migration/status";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type MigrationReceiptRecord = Infer<typeof migrationReceiptRecordValidator>;
type MigrationStatus = Infer<typeof migrationStatusValidator>;
type CleanupReceipt = Infer<typeof cleanupReceiptValidator>;
type CleanupResult = Infer<typeof cleanupResultValidator>;
type SealRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "seal" }
>;
type CleanupRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "cleanup" }
>;

const sealReference = makeFunctionReference<
  "mutation",
  { receiptJson: string },
  MigrationReceiptRecord
>("tryouts/migration/seal:seal");
const cleanupReference = makeFunctionReference<
  "mutation",
  {
    migrationId: string;
    proof: TryoutHistoryMigrationProof;
    receiptHash: string;
  },
  CleanupResult
>("tryouts/migration/cleanup/run:cleanup");
const receiptReference = makeFunctionReference<
  "query",
  { migrationId: string },
  CleanupReceipt
>("tryouts/migration/state/query:receipt");

/** Strictly restores the branded proof previously admitted by GitHub. */
const decodeCleanupProof = Effect.fn("tryouts.migration.decodeCleanupProof")(
  (proof: unknown) =>
    Schema.decodeUnknownEffect(TryoutHistoryMigrationProofSchema, {
      onExcessProperty: "error",
    })(proof).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Stored try-out history cleanup proof is invalid.",
          })
      )
    )
);

function hasSameCleanupProof(
  left: TryoutHistoryMigrationProof,
  right: TryoutHistoryMigrationProof
) {
  return (
    left.assetHash === right.assetHash && left.sourceSha === right.sourceSha
  );
}

/** Requires one cleanup transaction to agree with the re-read terminal phase. */
export const requireCleanupProgress = Effect.fn(
  "tryouts.migration.requireCleanupProgress"
)(function* (result: CleanupResult, phase: MigrationStatus["phase"]) {
  if (
    result.deleted < 0 ||
    result.repaired < 0 ||
    (result.deleted === 0 && result.repaired === 0 && !result.done)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup made no bounded progress."
    );
  }
  if (
    (result.done && phase !== "cleaned") ||
    (!result.done && phase !== "sealed")
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup progress disagrees with terminal state."
    );
  }
});

/** Authenticates and persists the exact terminal receipt under the active key. */
export const sealMigrationReceipt = Effect.fn("tryouts.migration.sealIngress")(
  function* (
    ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
    request: SealRequest,
    activeKeyId: string
  ) {
    const authenticated = yield* authenticateMigrationReceipt(request.receipt);
    if (authenticated.receipt.payload.migrationId !== request.releaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history migration receipt changed its request identity."
      );
    }
    const current = yield* readMigrationStatus(ctx, request.releaseId);
    if (current.phase === "sealed" || current.phase === "cleaned") {
      if (
        canonicalizeSignedTryoutHistoryMigrationReceipt(current.receipt) !==
        authenticated.receiptJson
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          "Try-out history migration already owns another terminal receipt."
        );
      }
      return {
        command: request.command,
        migrationId: request.releaseId,
        status: current,
      };
    }
    if (
      current.phase !== "completed" ||
      !hasSameCompletedStatus(current, authenticated.receipt)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history migration receipt differs from verified completion."
      );
    }
    yield* requireActiveContentKey(
      authenticated.receipt.keyId,
      activeKeyId,
      `Try-out history migration receipt ${authenticated.receipt.receiptHash}`
    );
    yield* callInternal(() =>
      ctx.runMutation(sealReference, {
        receiptJson: authenticated.receiptJson,
      })
    );
    return {
      command: request.command,
      migrationId: request.releaseId,
      status: yield* readMigrationStatus(ctx, request.releaseId),
    };
  }
);

/** Deletes one bounded legacy page under the exact persisted signed receipt. */
export const cleanupMigrationReceipt = Effect.fn(
  "tryouts.migration.cleanupIngress"
)(function* (
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  request: CleanupRequest
) {
  const authenticated = yield* authenticateMigrationReceipt(request.receipt);
  if (authenticated.receipt.payload.migrationId !== request.releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup receipt changed its request identity."
    );
  }
  const current = yield* readMigrationStatus(ctx, request.releaseId);
  if (current.phase !== "sealed" && current.phase !== "cleaned") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history cleanup requires a persisted terminal receipt."
    );
  }
  if (
    canonicalizeSignedTryoutHistoryMigrationReceipt(current.receipt) !==
    authenticated.receiptJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      "Try-out history cleanup received another terminal receipt."
    );
  }
  const durable = yield* callInternal(() =>
    ctx.runQuery(receiptReference, { migrationId: request.releaseId })
  );
  if (!durable) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup lost its durable receipt state."
    );
  }
  if (
    !Number.isSafeInteger(durable.deletedRows) ||
    durable.deletedRows < 0 ||
    durable.deletedRows >
      authenticated.receipt.payload.completion.cleanupLimit ||
    (durable.phase === "cleaned" && durable.deletedRows === 0) ||
    (current.phase === "cleaned" && durable.phase !== "cleaned")
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup has invalid durable progress."
    );
  }
  if (
    durable.phase === "cleaned" &&
    !hasRequiredScaleRepair(request.releaseId, durable.repair)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Cleaned try-out history migration lost its durable repair audit."
    );
  }
  let proof: TryoutHistoryMigrationProof;
  if (durable.proof) {
    proof = yield* decodeCleanupProof(durable.proof);
    if (!hasSameCleanupProof(proof, request.proof)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Try-out history cleanup already owns another immutable proof."
      );
    }
  } else {
    if (
      current.phase !== "sealed" ||
      durable.phase !== "sealed" ||
      durable.deletedRows !== 0
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history cleanup progress has no immutable proof."
      );
    }
    proof = yield* verifyImmutableMigrationReceipt(
      authenticated.receipt,
      request.proof
    );
  }
  if (current.phase === "cleaned") {
    return {
      command: request.command,
      deleted: 0,
      migrationId: request.releaseId,
      status: current,
    };
  }
  const result = yield* callInternal(() =>
    ctx.runMutation(cleanupReference, {
      migrationId: request.releaseId,
      proof,
      receiptHash: authenticated.receipt.receiptHash,
    })
  );
  const status = yield* readMigrationStatus(ctx, request.releaseId);
  yield* requireCleanupProgress(result, status.phase);
  return {
    command: request.command,
    deleted: result.deleted,
    migrationId: request.releaseId,
    status,
  };
});
