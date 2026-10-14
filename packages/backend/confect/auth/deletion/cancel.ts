import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_ATTEMPT_RETENTION_MS,
  ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import type { AccountDeletionPreparationVersion } from "@repo/backend/confect/auth/deletion/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Clock, Effect, flow } from "effect";
/** Proves that one opaque attempt was already canceled. */
export const hasAccountDeletionCancellation = Effect.fn(
  "auth.deletion.hasAccountDeletionCancellation"
)(
  function* (attemptId: string) {
    const database = yield* DatabaseReader;
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
  function* (attemptId: string) {
    const writer = yield* DatabaseWriter;
    if (yield* hasAccountDeletionCancellation(attemptId)) {
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
  function* () {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const cancellations = yield* database
      .table("accountDeletionAttemptCancellations")
      .index("by_canceledAt", (query) =>
        query.lt("canceledAt", now - ACCOUNT_DELETION_ATTEMPT_RETENTION_MS)
      )
      .take(ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE + 1)
      .pipe(Effect.orDie);
    for (const cancellation of Arr.take(
      cancellations,
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

/**
 * Removes one prepared deletion, restores app access to its user, and records
 * the cancellation, all in one transaction.
 */
export const cancelPreparedAccountDeletion = Effect.fn(
  "auth.deletion.cancelPreparedAccountDeletion"
)(
  function* (
    preparation: Docs["accountDeletionPreparations"] &
      Pick<AccountDeletionPreparationVersion, "attemptId">
  ) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    yield* writer.table("accountDeletionPreparations").delete(preparation._id);
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
    yield* recordAccountDeletionCancellation(preparation.attemptId);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Restores app access after Better Auth aborts before removing the auth user. */
export const cancelAccountDeletion = Effect.fn(
  "auth.deletion.cancelAccountDeletion"
)(
  function* (
    authId: string,
    expectedPreparation: AccountDeletionPreparationVersion
  ) {
    const database = yield* DatabaseReader;
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
      return;
    }
    yield* cancelPreparedAccountDeletion({
      ...preparation,
      attemptId: expectedPreparation.attemptId,
    });
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Removes finalized preparation metadata once its cleanup workflow is active. */
export const cleanupFinalizedAccountDeletion = Effect.fn(
  "auth.deletion.cleanupFinalizedAccountDeletion"
)(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
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
    yield* writer.table("accountDeletionPreparations").delete(preparation._id);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
