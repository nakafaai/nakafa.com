import { components } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { finalizeAccountDeletion } from "@repo/backend/convex/auth/deletion/finalize";
import type { AccountDeletionPreparationVersion } from "@repo/backend/convex/auth/deletion/spec";
import { makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

const continueAccountDeletionCommitReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation: AccountDeletionPreparationVersion;
  },
  boolean
>("auth/deletion:continueAccountDeletionCommit");

const betterAuthDeletePageSchema = Schema.Struct({
  count: Schema.Number,
});
const decodeBetterAuthDeletePage = Schema.decodeUnknownSync(
  betterAuthDeletePageSchema
);

interface AccountDeletionCommitOperations {
  readonly deleteAccounts: () => Promise<number>;
  readonly deleteAuthUser: () => Promise<unknown>;
  readonly deleteSessions: () => Promise<number>;
  readonly scheduleContinuation: () => Promise<unknown>;
}

function createAccountDeletionCommitOperations(
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
): AccountDeletionCommitOperations {
  const deletePage = async (model: "account" | "session") => {
    const result: unknown = await ctx.runMutation(
      components.betterAuth.adapter.deleteMany,
      {
        input: {
          model,
          where: [{ field: "userId", operator: "eq", value: authId }],
        },
        paginationOpts: {
          cursor: null,
          numItems: ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
        },
      }
    );

    return decodeBetterAuthDeletePage(result).count;
  };

  return {
    deleteAccounts: () => deletePage("account"),
    deleteAuthUser: () =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "user",
          where: [{ field: "_id", operator: "eq", value: authId }],
        },
      }),
    deleteSessions: () => deletePage("session"),
    scheduleContinuation: () =>
      ctx.scheduler.runAfter(0, continueAccountDeletionCommitReference, {
        authId,
        expectedPreparation,
      }),
  };
}

/**
 * Finishes a claimed Better Auth deletion in bounded component transactions.
 *
 * Calls from this parent mutation into the Better Auth component commit
 * atomically with app finalization.
 * @see https://docs.convex.dev/components/using#transactions
 */
export const continueAccountDeletionCommitProgram: (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion,
  operations?: AccountDeletionCommitOperations
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.continueAccountDeletionCommit"
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion,
  operations = createAccountDeletionCommitOperations(
    ctx,
    authId,
    expectedPreparation
  )
) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (
    !preparation ||
    preparation.attemptId !== expectedPreparation.attemptId ||
    preparation._id !== expectedPreparation.preparationId ||
    preparation.recoveryGeneration !== expectedPreparation.recoveryGeneration ||
    preparation.deletionStartedAt === undefined
  ) {
    return false;
  }

  if (preparation.finalizedAt !== undefined) {
    return true;
  }

  if ((yield* tryUserCleanup(operations.deleteSessions)) > 0) {
    yield* tryUserCleanup(operations.scheduleContinuation);
    return true;
  }

  if ((yield* tryUserCleanup(operations.deleteAccounts)) > 0) {
    yield* tryUserCleanup(operations.scheduleContinuation);
    return true;
  }

  yield* tryUserCleanup(operations.deleteAuthUser);
  yield* finalizeAccountDeletion(ctx, authId, expectedPreparation);

  return true;
});
