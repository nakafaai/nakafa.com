import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { finalizeAccountDeletion } from "@repo/backend/confect/auth/deletion/finalize";
import type { AccountDeletionPreparationVersion } from "@repo/backend/confect/auth/deletion/spec";
import { Duration, Effect, flow, Schema } from "effect";

const betterAuthDeletePageSchema = Schema.Struct({
  count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
const decodeBetterAuthDeletePage = Schema.decodeUnknownEffect(
  betterAuthDeletePageSchema
);
interface AccountDeletionCommitOperations {
  readonly deleteAccounts: Effect.Effect<number, UserCleanupError>;
  readonly deleteAuthUser: Effect.Effect<unknown, UserCleanupError>;
  readonly deleteSessions: Effect.Effect<number, UserCleanupError>;
  readonly scheduleContinuation: Effect.Effect<unknown, UserCleanupError>;
}
const createAccountDeletionCommitOperations = Effect.fn(
  "auth.deletion.commitOperations"
)(function* (
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  const ctx = yield* MutationCtx;
  const scheduler = yield* Scheduler;
  const deletePage = Effect.fn("auth.deletion.deleteAuthPage")(function* (
    model: "account" | "session"
  ) {
    const result = yield* tryUserCleanup(() =>
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model,
          where: [
            {
              field: "userId",
              operator: "eq",
              value: authId,
            },
          ],
        },
        paginationOpts: {
          cursor: null,
          numItems: ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
        },
      })
    );
    const page = yield* decodeBetterAuthDeletePage(result).pipe(
      Effect.mapError(toUserCleanupError)
    );
    return page.count;
  });
  return {
    deleteAccounts: deletePage("account"),
    deleteAuthUser: tryUserCleanup(() =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "user",
          where: [
            {
              field: "_id",
              operator: "eq",
              value: authId,
            },
          ],
        },
      })
    ),
    deleteSessions: deletePage("session"),
    scheduleContinuation: scheduler
      .runAfter(
        Duration.zero,
        refs.internal.auth.deletion.continueAccountDeletionCommit,
        {
          authId,
          expectedPreparation,
        }
      )
      .pipe(Effect.catchDefect(flow(toUserCleanupError, Effect.fail))),
  } satisfies AccountDeletionCommitOperations;
});

/**
 * Finishes a claimed Better Auth deletion in bounded component transactions.
 *
 * Calls from this parent mutation into the Better Auth component commit
 * atomically with app finalization.
 * @see https://docs.convex.dev/components/using#transactions
 */
export const continueAccountDeletionCommitProgram = Effect.fn(
  "auth.deletion.continueAccountDeletionCommit"
)(
  function* (
    authId: string,
    expectedPreparation: AccountDeletionPreparationVersion,
    operations?: AccountDeletionCommitOperations
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
      preparation.attemptId !== expectedPreparation.attemptId ||
      preparation._id !== expectedPreparation.preparationId ||
      preparation.recoveryGeneration !==
        expectedPreparation.recoveryGeneration ||
      preparation.cancellationStartedAt !== undefined ||
      preparation.deletionStartedAt === undefined
    ) {
      return false;
    }
    if (preparation.finalizedAt !== undefined) {
      return true;
    }
    const commit =
      operations ??
      (yield* createAccountDeletionCommitOperations(
        authId,
        expectedPreparation
      ));
    if ((yield* commit.deleteSessions) > 0) {
      yield* commit.scheduleContinuation;
      return true;
    }
    if ((yield* commit.deleteAccounts) > 0) {
      yield* commit.scheduleContinuation;
      return true;
    }
    yield* commit.deleteAuthUser;
    yield* finalizeAccountDeletion(authId, expectedPreparation);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
