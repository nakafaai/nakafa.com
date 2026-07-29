import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_ATTEMPT_RETENTION_MS,
  ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE,
  ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import type { AccountDeletionPreparationVersion } from "@repo/backend/convex/auth/deletion/spec";
import { makeFunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

const cancelAccountDeletionReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation: AccountDeletionPreparationVersion;
  },
  boolean
>("auth/deletion:cancelAccountDeletion");

/** Proves that one opaque attempt was already canceled. */
export const hasAccountDeletionCancellation = Effect.fn(
  "auth.deletion.hasAccountDeletionCancellation"
)(function* (ctx: MutationCtx, attemptId: string) {
  const cancellation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionAttemptCancellations")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attemptId))
      .unique()
  );

  return cancellation !== null;
});

/** Persists one privacy-minimal cancellation tombstone idempotently. */
export const recordAccountDeletionCancellation = Effect.fn(
  "auth.deletion.recordAccountDeletionCancellation"
)(function* (ctx: MutationCtx, attemptId: string | undefined) {
  if (attemptId === undefined) {
    return;
  }

  if (yield* hasAccountDeletionCancellation(ctx, attemptId)) {
    return;
  }

  const canceledAt = yield* Clock.currentTimeMillis;

  yield* tryUserCleanup(() =>
    ctx.db.insert("accountDeletionAttemptCancellations", {
      attemptId,
      canceledAt,
    })
  );
});

/** Deletes one bounded page of expired cancellation tombstones. */
export const sweepAccountDeletionCancellationsProgram = Effect.fn(
  "auth.deletion.sweepAccountDeletionCancellations"
)(function* (ctx: MutationCtx) {
  const now = yield* Clock.currentTimeMillis;
  const cancellations = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionAttemptCancellations")
      .withIndex("by_canceledAt", (query) =>
        query.lt("canceledAt", now - ACCOUNT_DELETION_ATTEMPT_RETENTION_MS)
      )
      .take(ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE + 1)
  );

  for (const cancellation of cancellations.slice(
    0,
    ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE
  )) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("accountDeletionAttemptCancellations", cancellation._id)
    );
  }

  return cancellations.length > ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
});

/** Removes one bounded reservation batch and then its empty preparation. */
export const deleteAccountDeletionPreparation = Effect.fn(
  "auth.deletion.deleteAccountDeletionPreparation"
)(function* (
  ctx: MutationCtx,
  preparation: Doc<"accountDeletionPreparations">
) {
  const transfers = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionSchoolTransfers")
      .withIndex("by_preparationId", (query) =>
        query.eq("preparationId", preparation._id)
      )
      .take(ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1)
  );

  for (const transfer of transfers.slice(
    0,
    ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE
  )) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("accountDeletionSchoolTransfers", transfer._id)
    );
  }

  if (transfers.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE) {
    return true;
  }

  yield* tryUserCleanup(() =>
    ctx.db.delete("accountDeletionPreparations", preparation._id)
  );
  return false;
});

/**
 * Drains one cancellation batch while keeping the user write-locked.
 *
 * The canceling marker prevents the same prepared attempt from being reclaimed
 * between bounded reservation batches. App access is restored atomically only
 * after the final reservation and preparation are gone.
 */
export const cancelPreparedAccountDeletion = Effect.fn(
  "auth.deletion.cancelPreparedAccountDeletion"
)(function* (
  ctx: MutationCtx,
  preparation: Doc<"accountDeletionPreparations">
) {
  if (preparation.cancellationStartedAt === undefined) {
    const cancellationStartedAt = yield* Clock.currentTimeMillis;

    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        cancellationStartedAt,
      })
    );
  }

  const hasMore = yield* deleteAccountDeletionPreparation(ctx, preparation);

  if (hasMore) {
    return true;
  }

  const user = yield* tryUserCleanup(() =>
    ctx.db.get("users", preparation.userId)
  );

  if (user?.deletionPreparedAt !== undefined) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("users", preparation.userId, {
        deletionPreparedAt: undefined,
      })
    );
  }

  yield* recordAccountDeletionCancellation(ctx, preparation.attemptId);
  return false;
});

/** Restores app access after Better Auth aborts before removing the auth user. */
export const cancelAccountDeletion: (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.cancelAccountDeletion"
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (
    !preparation ||
    preparation.deletionStartedAt !== undefined ||
    preparation.finalizedAt !== undefined ||
    preparation.attemptId !== expectedPreparation.attemptId ||
    preparation._id !== expectedPreparation.preparationId ||
    preparation.recoveryGeneration !== expectedPreparation.recoveryGeneration
  ) {
    return false;
  }

  return yield* cancelPreparedAccountDeletion(ctx, preparation);
});

/** Cancels one versioned reservation batch and schedules any continuation. */
export const cancelAccountDeletionBatch = Effect.fn(
  "auth.deletion.cancelAccountDeletionBatch"
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  const hasMore = yield* cancelAccountDeletion(
    ctx,
    authId,
    expectedPreparation
  );

  if (hasMore) {
    yield* tryUserCleanup(() =>
      ctx.scheduler.runAfter(0, cancelAccountDeletionReference, {
        authId,
        expectedPreparation,
      })
    );
  }

  return hasMore;
});

/** Removes finalized preparation metadata once its cleanup workflow is active. */
export const cleanupFinalizedAccountDeletion: (
  ctx: MutationCtx,
  userId: Id<"users">
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.cleanupFinalizedAccountDeletion"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .unique()
  );

  if (!preparation) {
    return false;
  }

  yield* deleteAccountDeletionPreparation(ctx, preparation);
  return true;
});
