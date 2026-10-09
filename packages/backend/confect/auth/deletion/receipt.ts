import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_ATTEMPT_RETENTION_MS,
  ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import { accountDeletionAttemptStatus } from "@repo/backend/confect/auth/deletion/spec";
import { Array as Arr, Clock, Effect, flow } from "effect";

type AuthUserExists = (
  authId: string
) => Effect.Effect<boolean, UserCleanupError>;

/**
 * Resolves whether a browser attempt committed without trusting an auth error
 * as proof. Receipts survive the personal-data cleanup journal briefly.
 */
export const getAccountDeletionAttemptStatusProgram = Effect.fn(
  "auth.deletion.getAccountDeletionAttemptStatus"
)(
  function* (attemptId: string, authUserExists: AuthUserExists) {
    const database = yield* DatabaseReader;
    const receipt = yield* database
      .table("accountDeletionReceipts")
      .get("by_attemptId", attemptId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (receipt) {
      return accountDeletionAttemptStatus.committed;
    }
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_attemptId", attemptId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!preparation) {
      return accountDeletionAttemptStatus.unknown;
    }
    if (preparation.finalizedAt !== undefined) {
      return accountDeletionAttemptStatus.committed;
    }
    const userStillExists = yield* authUserExists(preparation.authId);
    return userStillExists
      ? accountDeletionAttemptStatus.pending
      : accountDeletionAttemptStatus.committed;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Persists only the opaque browser attempt token after deletion commits. */
export const recordAccountDeletionReceipt = Effect.fn(
  "auth.deletion.recordAccountDeletionReceipt"
)(function* (attemptId: string | undefined, committedAt: number) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (attemptId === undefined) {
    return;
  }
  const receipt = yield* database
    .table("accountDeletionReceipts")
    .get("by_attemptId", attemptId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  if (receipt) {
    return;
  }
  yield* writer.table("accountDeletionReceipts").insert({
    attemptId,
    committedAt,
  });
}, Effect.mapError(toUserCleanupError));

/** Deletes one bounded page of expired commit receipts. */
export const sweepAccountDeletionReceiptsProgram = Effect.fn(
  "auth.deletion.sweepAccountDeletionReceipts"
)(
  function* () {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const receipts = yield* database
      .table("accountDeletionReceipts")
      .index("by_committedAt", (query) =>
        query.lt("committedAt", now - ACCOUNT_DELETION_ATTEMPT_RETENTION_MS)
      )
      .take(ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE + 1)
      .pipe(Effect.orDie);
    for (const receipt of Arr.take(
      receipts,
      ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE
    )) {
      yield* writer.table("accountDeletionReceipts").delete(receipt._id);
    }
    return receipts.length > ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
