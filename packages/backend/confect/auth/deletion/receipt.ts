import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_ATTEMPT_RETENTION_MS,
  ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import {
  type AccountDeletionAttemptStatus,
  accountDeletionAttemptStatus,
} from "@repo/backend/confect/auth/deletion/spec";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Clock, Effect, flow } from "effect";

type AuthUserExists = (
  authId: string
) => Effect.Effect<boolean, UserCleanupError>;

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
)(
  function* (ctx: QueryCtx, attemptId: string, authUserExists: AuthUserExists) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
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
export const recordAccountDeletionReceipt: (
  ctx: MutationCtx,
  attemptId: string | undefined,
  committedAt: number
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.recordAccountDeletionReceipt"
)(
  function* (
    ctx: MutationCtx,
    attemptId: string | undefined,
    committedAt: number
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
  },
  Effect.orDie,
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded page of expired commit receipts. */
export const sweepAccountDeletionReceiptsProgram: (
  ctx: MutationCtx
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.sweepAccountDeletionReceipts"
)(
  function* (ctx: MutationCtx) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const now = yield* Clock.currentTimeMillis;
    const receipts = yield* database
      .table("accountDeletionReceipts")
      .index("by_committedAt", (query) =>
        query.lt("committedAt", now - ACCOUNT_DELETION_ATTEMPT_RETENTION_MS)
      )
      .take(ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE + 1)
      .pipe(Effect.orDie);
    for (const receipt of receipts.slice(
      0,
      ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE
    )) {
      yield* writer.table("accountDeletionReceipts").delete(receipt._id);
    }
    return receipts.length > ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
