"use node";

import { canonicalizeSignedTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import { verifySignedTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/verify";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  hasRequiredScaleRepair,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { decodeMigrationPlan } from "@repo/backend/convex/tryouts/migration/plan";
import {
  authenticateMigrationReceipt,
  hasSameCompletedStatus,
  hasSameReceiptRecord,
} from "@repo/backend/convex/tryouts/migration/proof/receipt";
import type {
  migrationRecordValidator,
  migrationStatusValidator,
  terminalRecordValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import { computeMigrationTarget } from "@repo/backend/convex/tryouts/migration/target";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type MigrationRecord = Infer<typeof migrationRecordValidator>;
type MigrationReceiptRecord = NonNullable<MigrationRecord["receipt"]>;
type MigrationStatus = Infer<typeof migrationStatusValidator>;
type TerminalRecord = Infer<typeof terminalRecordValidator>;

const recordReference = makeFunctionReference<
  "query",
  { migrationId: string },
  MigrationRecord
>("tryouts/migration/state/store:record");
const terminalReference = makeFunctionReference<
  "query",
  { migrationId: string },
  TerminalRecord
>("tryouts/migration/terminal:terminal");

/** Requires the durable repair audit before exposing cleaned terminal state. */
export const requireTerminalRepair = Effect.fn(
  "tryouts.migration.requireTerminalRepair"
)(function* (
  receipt: Pick<
    MigrationReceiptRecord,
    "migrationId" | "phase" | "proof" | "repair"
  >
) {
  const repairStarted =
    receipt.phase === "cleaned" ||
    receipt.proof !== null ||
    receipt.repair !== null;
  const proofMissing =
    receipt.migrationId === retainedScaleRepair.migrationId &&
    repairStarted &&
    receipt.proof === null;
  if (
    repairStarted &&
    (proofMissing ||
      !hasRequiredScaleRepair(receipt.migrationId, receipt.repair))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration lost its durable repair audit."
    );
  }
});

/** Recomputes the complete permanent target before terminal state is exposed. */
const verifyCompletedStatus = Effect.fn(
  "tryouts.migration.verifyCompletedStatus"
)(function* (
  ctx: Pick<ActionCtx, "runQuery">,
  status: Extract<MigrationStatus, { readonly phase: "completed" }>
) {
  const terminal = yield* callInternal(() =>
    ctx.runQuery(terminalReference, { migrationId: status.migrationId })
  );
  const decodedPlan = yield* decodeMigrationPlan(terminal.planJson);
  const plan = yield* verifySignedTryoutHistoryMigrationPlan(decodedPlan).pipe(
    Effect.mapError(contractFailure)
  );
  const target = yield* computeMigrationTarget(ctx, status.migrationId);
  if (
    canonicalizeSignedTryoutHistoryMigrationPlan(plan) !== terminal.planJson ||
    JSON.stringify(terminal.status) !== JSON.stringify(status) ||
    JSON.stringify(target) !== JSON.stringify(plan.payload.target)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Completed try-out history migration changed its signed target evidence."
    );
  }
  return terminal.status;
});

/** Reads and reauthenticates authoritative active, sealed, or cleaned state. */
export const readMigrationStatus = Effect.fn("tryouts.migration.readStatus")(
  function* (ctx: Pick<ActionCtx, "runQuery">, migrationId: string) {
    const record = yield* callInternal(() =>
      ctx.runQuery(recordReference, { migrationId })
    );
    if (!record.receipt) {
      if (record.cleanupStarted) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history cleanup lost its permanent signed receipt."
        );
      }
      if (record.status) {
        return record.status.phase === "completed"
          ? yield* verifyCompletedStatus(ctx, record.status)
          : record.status;
      }
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Try-out history migration ${migrationId} does not exist.`
      );
    }
    const storedReceipt = yield* parseStoredJson(
      record.receipt.receiptJson,
      "Try-out history migration receipt"
    );
    const authenticated = yield* authenticateMigrationReceipt(storedReceipt);
    if (
      !hasSameReceiptRecord(
        record.receipt,
        authenticated.receipt,
        authenticated.receiptJson
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Stored try-out history migration receipt changed signed identity."
      );
    }
    yield* requireTerminalRepair(record.receipt);
    if (!record.status) {
      if (record.receipt.phase !== "cleaned") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Sealed try-out history migration lost its root before terminal cleanup."
        );
      }
      return {
        migrationId,
        phase: "cleaned",
        receipt: authenticated.receipt,
      } satisfies MigrationStatus;
    }
    if (record.receipt.phase !== "sealed") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Cleaned try-out history migration still retains temporary state."
      );
    }
    if (
      record.status.phase !== "completed" ||
      !hasSameCompletedStatus(record.status, authenticated.receipt)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Sealed try-out history migration changed terminal evidence."
      );
    }
    const completed = record.cleanupStarted
      ? record.status
      : yield* verifyCompletedStatus(ctx, record.status);
    return {
      ...completed,
      phase: "sealed",
      receipt: authenticated.receipt,
    } satisfies MigrationStatus;
  }
);
