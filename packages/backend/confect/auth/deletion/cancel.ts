import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_ATTEMPT_RETENTION_MS,
  ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE,
  ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import type { AccountDeletionPreparationVersion } from "@repo/backend/confect/auth/deletion/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, flow } from "effect";
/** Proves that one opaque attempt was already canceled. */
export const hasAccountDeletionCancellation = Effect.fn(
  "auth.deletion.hasAccountDeletionCancellation"
)(
  function* (ctx: MutationCtx, attemptId: string) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const cancellation = yield* database
      .table("accountDeletionAttemptCancellations")
      .get("by_attemptId", attemptId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return cancellation !== null;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Persists one privacy-minimal cancellation tombstone idempotently. */
const recordAccountDeletionCancellation = Effect.fn(
  "auth.deletion.recordAccountDeletionCancellation"
)(
  function* (ctx: MutationCtx, attemptId: string) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    if (yield* hasAccountDeletionCancellation(ctx, attemptId)) {
      return;
    }
    const canceledAt = yield* Clock.currentTimeMillis;
    yield* writer
      .table("accountDeletionAttemptCancellations")
      .insert({
        attemptId,
        canceledAt,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded page of expired cancellation tombstones. */
export const sweepAccountDeletionCancellationsProgram = Effect.fn(
  "auth.deletion.sweepAccountDeletionCancellations"
)(
  function* (ctx: MutationCtx) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const now = yield* Clock.currentTimeMillis;
    const cancellations = yield* database
      .table("accountDeletionAttemptCancellations")
      .index("by_canceledAt", (query) =>
        query.lt("canceledAt", now - ACCOUNT_DELETION_ATTEMPT_RETENTION_MS)
      )
      .take(ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE + 1)
      .pipe(Effect.orDie);
    for (const cancellation of cancellations.slice(
      0,
      ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE
    )) {
      yield* writer
        .table("accountDeletionAttemptCancellations")
        .delete(cancellation._id);
    }
    return cancellations.length > ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Removes one bounded reservation batch and then its empty preparation. */
export const deleteAccountDeletionPreparation = Effect.fn(
  "auth.deletion.deleteAccountDeletionPreparation"
)(
  function* (
    ctx: MutationCtx,
    preparation: Doc<"accountDeletionPreparations">
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const transfers = yield* database
      .table("accountDeletionSchoolTransfers")
      .index("by_preparationId", (query) =>
        query.eq("preparationId", preparation._id)
      )
      .take(ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1)
      .pipe(Effect.orDie);
    for (const transfer of transfers.slice(
      0,
      ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE
    )) {
      yield* writer
        .table("accountDeletionSchoolTransfers")
        .delete(transfer._id);
    }
    if (transfers.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE) {
      return true;
    }
    yield* writer.table("accountDeletionPreparations").delete(preparation._id);
    return false;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/**
 * Drains one cancellation batch while keeping the user write-locked.
 *
 * The canceling marker prevents the same prepared attempt from being reclaimed
 * between bounded reservation batches. App access is restored atomically only
 * after the final reservation and preparation are gone.
 */
export const cancelPreparedAccountDeletion = Effect.fn(
  "auth.deletion.cancelPreparedAccountDeletion"
)(
  function* (
    ctx: MutationCtx,
    preparation: Doc<"accountDeletionPreparations"> &
      Pick<AccountDeletionPreparationVersion, "attemptId">
  ) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    if (preparation.cancellationStartedAt === undefined) {
      const cancellationStartedAt = yield* Clock.currentTimeMillis;
      yield* writer
        .table("accountDeletionPreparations")
        .patch(preparation._id, {
          cancellationStartedAt,
        })
        .pipe(Effect.orDie);
    }
    const hasMore = yield* deleteAccountDeletionPreparation(ctx, preparation);
    if (hasMore) {
      return true;
    }
    const user = yield* database
      .table("users")
      .get(preparation.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user?.deletionPreparedAt !== undefined) {
      yield* writer
        .table("users")
        .patch(preparation.userId, {
          deletionPreparedAt: undefined,
        })
        .pipe(Effect.orDie);
    }
    yield* recordAccountDeletionCancellation(ctx, preparation.attemptId);
    return false;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Restores app access after Better Auth aborts before removing the auth user. */
export const cancelAccountDeletion: (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.cancelAccountDeletion"
)(
  function* (
    ctx: MutationCtx,
    authId: string,
    expectedPreparation: AccountDeletionPreparationVersion
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
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
    return yield* cancelPreparedAccountDeletion(ctx, {
      ...preparation,
      attemptId: expectedPreparation.attemptId,
    });
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Cancels one versioned reservation batch and schedules any continuation. */
export const cancelAccountDeletionBatch = Effect.fn(
  "auth.deletion.cancelAccountDeletionBatch"
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  const scheduler = yield* Scheduler.Scheduler.pipe(
    Effect.provide(Scheduler.layer(ctx.scheduler))
  );
  const hasMore = yield* cancelAccountDeletion(
    ctx,
    authId,
    expectedPreparation
  );
  if (hasMore) {
    yield* scheduler
      .runAfter(
        Duration.millis(0),
        refs.internal.auth.deletion.cancelAccountDeletion,
        {
          authId,
          expectedPreparation,
        }
      )
      .pipe(Effect.catchDefect(flow(toUserCleanupError, Effect.fail)));
  }
  return hasMore;
});

/** Removes finalized preparation metadata once its cleanup workflow is active. */
export const cleanupFinalizedAccountDeletion: (
  ctx: MutationCtx,
  userId: Id<"users">
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.cleanupFinalizedAccountDeletion"
)(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_userId", userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!preparation) {
      return false;
    }
    yield* deleteAccountDeletionPreparation(ctx, preparation);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
