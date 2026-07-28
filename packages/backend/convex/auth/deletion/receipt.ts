import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_RECEIPT_RETENTION_MS,
  ACCOUNT_DELETION_RECEIPT_SWEEP_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionAttemptStatus,
  accountDeletionAttemptStatus,
} from "@repo/backend/convex/auth/deletion/spec";
import { Clock, Effect } from "effect";

type AuthUserExists = (authId: string) => Promise<boolean>;

/**
 * Resolves whether a browser attempt committed without trusting an auth error
 * as proof. Receipts survive the personal-data cleanup journal briefly.
 */
export const getAccountDeletionAttemptStatusProgram: (
  ctx: QueryCtx,
  attemptId: string,
  authUserExists: AuthUserExists
) => Effect.Effect<AccountDeletionAttemptStatus, UserCleanupError> = Effect.fn(
  "auth.deletion.getAccountDeletionAttemptStatus"
)(function* (ctx: QueryCtx, attemptId: string, authUserExists: AuthUserExists) {
  const receipt = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionReceipts")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attemptId))
      .unique()
  );

  if (receipt) {
    return accountDeletionAttemptStatus.committed;
  }

  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attemptId))
      .unique()
  );

  if (!preparation) {
    return accountDeletionAttemptStatus.unknown;
  }

  if (preparation.finalizedAt !== undefined) {
    return accountDeletionAttemptStatus.committed;
  }

  const userStillExists = yield* tryUserCleanup(() =>
    authUserExists(preparation.authId)
  );

  return userStillExists
    ? accountDeletionAttemptStatus.pending
    : accountDeletionAttemptStatus.committed;
});

/** Persists only the opaque browser attempt token after deletion commits. */
export const recordAccountDeletionReceipt: (
  ctx: MutationCtx,
  attemptId: string | undefined,
  committedAt: number
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.recordAccountDeletionReceipt"
)(function* (
  ctx: MutationCtx,
  attemptId: string | undefined,
  committedAt: number
) {
  if (attemptId === undefined) {
    return;
  }

  const receipt = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionReceipts")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attemptId))
      .unique()
  );

  if (receipt) {
    return;
  }

  yield* tryUserCleanup(() =>
    ctx.db.insert("accountDeletionReceipts", {
      attemptId,
      committedAt,
    })
  );
});

/** Deletes one bounded page of expired commit receipts. */
export const sweepAccountDeletionReceiptsProgram: (
  ctx: MutationCtx
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.sweepAccountDeletionReceipts"
)(function* (ctx: MutationCtx) {
  const now = yield* Clock.currentTimeMillis;
  const receipts = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionReceipts")
      .withIndex("by_committedAt", (query) =>
        query.lt("committedAt", now - ACCOUNT_DELETION_RECEIPT_RETENTION_MS)
      )
      .take(ACCOUNT_DELETION_RECEIPT_SWEEP_BATCH_SIZE + 1)
  );

  for (const receipt of receipts.slice(
    0,
    ACCOUNT_DELETION_RECEIPT_SWEEP_BATCH_SIZE
  )) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("accountDeletionReceipts", receipt._id)
    );
  }

  return receipts.length > ACCOUNT_DELETION_RECEIPT_SWEEP_BATCH_SIZE;
});
