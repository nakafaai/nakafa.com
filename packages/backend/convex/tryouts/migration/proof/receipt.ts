import { canonicalizeSignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import type { SignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import { verifySignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/verify";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type {
  migrationReceiptRecordValidator,
  migrationStatusValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type MigrationReceiptRecord = Infer<typeof migrationReceiptRecordValidator>;
type MigrationStatus = Infer<typeof migrationStatusValidator>;

/** Authenticates one signed receipt and returns its canonical wire bytes. */
export const authenticateMigrationReceipt = Effect.fn(
  "tryouts.migration.authenticateReceipt"
)(function* (input: unknown) {
  const receipt = yield* verifySignedTryoutHistoryMigrationReceipt(input).pipe(
    Effect.mapError(contractFailure)
  );
  return {
    receipt,
    receiptJson: canonicalizeSignedTryoutHistoryMigrationReceipt(receipt),
  };
});

/** Checks the indexed receipt row repeats every signed payload fact exactly. */
export function hasSameReceiptRecord(
  record: MigrationReceiptRecord,
  receipt: SignedTryoutHistoryMigrationReceipt,
  receiptJson: string
) {
  const completion = receipt.payload.completion;
  return (
    record.cleanupLimit === completion.cleanupLimit &&
    record.completedAt === completion.completedAt &&
    record.migratedAttempts === completion.migratedAttempts &&
    record.migratedScaleItems === completion.migratedScaleItems &&
    record.migratedScaleRuns === completion.migratedScaleRuns &&
    record.migratedScaleVersions === completion.migratedScaleVersions &&
    record.migrationId === receipt.payload.migrationId &&
    record.planHash === receipt.payload.planHash &&
    record.receiptHash === receipt.receiptHash &&
    record.receiptJson === receiptJson &&
    record.sourceSnapshotId === receipt.payload.sourceSnapshotId &&
    record.targetBundleHash === receipt.payload.targetBundleHash &&
    record.targetSnapshotId === receipt.payload.targetSnapshotId
  );
}

/** Checks a completed root repeats every fact covered by the signed receipt. */
export function hasSameCompletedStatus(
  status: Extract<MigrationStatus, { readonly phase: "completed" }>,
  receipt: SignedTryoutHistoryMigrationReceipt
) {
  const completion = receipt.payload.completion;
  return (
    status.migrationId === receipt.payload.migrationId &&
    status.planHash === receipt.payload.planHash &&
    status.sourceSnapshotId === receipt.payload.sourceSnapshotId &&
    status.targetBundleHash === receipt.payload.targetBundleHash &&
    status.targetSnapshotId === receipt.payload.targetSnapshotId &&
    status.completion.cleanupLimit === completion.cleanupLimit &&
    status.completion.completedAt === completion.completedAt &&
    status.completion.migratedAttempts === completion.migratedAttempts &&
    status.completion.migratedScaleItems === completion.migratedScaleItems &&
    status.completion.migratedScaleRuns === completion.migratedScaleRuns &&
    status.completion.migratedScaleVersions === completion.migratedScaleVersions
  );
}
