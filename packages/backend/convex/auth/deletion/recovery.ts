import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionPreparationVersion,
  accountDeletionPreparationVersionValidator,
} from "@repo/backend/convex/auth/deletion/spec";
import { authReader } from "@repo/backend/convex/auth/reader";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const cancelAccountDeletionReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation?: AccountDeletionPreparationVersion;
  },
  boolean
>("auth/deletion:cancelAccountDeletion");
const finalizeDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation?: AccountDeletionPreparationVersion;
  },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");
const recoverAccountDeletionReference = makeFunctionReference<
  "action",
  {
    authId: string;
    expectedPreparation: AccountDeletionPreparationVersion;
  },
  null
>("auth/deletion/recovery:recoverAccountDeletion");

interface RecoveryOperations {
  readonly authUserExists: () => Promise<boolean>;
  readonly cancel: () => Promise<boolean>;
  readonly finalize: () => Promise<unknown>;
  readonly reschedule: () => Promise<unknown>;
}

/** Restores an aborted deletion or finishes one whose auth user is gone. */
export const recoverAccountDeletionProgram: (
  operations: RecoveryOperations
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.recoverAccountDeletion"
)(function* (operations: RecoveryOperations) {
  const recoveryAttempt = Effect.gen(function* () {
    const authUserExists = yield* tryUserCleanup(operations.authUserExists);

    if (authUserExists) {
      let hasMore = yield* tryUserCleanup(operations.cancel);

      while (hasMore) {
        hasMore = yield* tryUserCleanup(operations.cancel);
      }
      return;
    }

    yield* tryUserCleanup(operations.finalize);
  });

  yield* recoveryAttempt.pipe(
    Effect.catchTag("UserCleanupError", (error) =>
      Effect.logError("Account deletion recovery attempt failed").pipe(
        Effect.annotateLogs({ error: error.message }),
        Effect.zipRight(tryUserCleanup(operations.reschedule))
      )
    )
  );
});

/** Reconciles one prepared deletion after the Better Auth request has settled. */
export const recoverAccountDeletion = internalAction({
  args: {
    authId: v.string(),
    expectedPreparation: accountDeletionPreparationVersionValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      recoverAccountDeletionProgram({
        authUserExists: async () =>
          (await authReader.getAnyUserById(ctx, args.authId)) !== null,
        cancel: () =>
          ctx.runMutation(cancelAccountDeletionReference, {
            authId: args.authId,
            expectedPreparation: args.expectedPreparation,
          }),
        finalize: () =>
          ctx.runMutation(finalizeDeletedUserCleanupReference, {
            authId: args.authId,
            expectedPreparation: args.expectedPreparation,
          }),
        reschedule: () =>
          scheduleRecoveryRetry(ctx, args.authId, args.expectedPreparation),
      }).pipe(Effect.annotateLogs({ authId: args.authId }))
    );

    return null;
  },
});

function scheduleRecoveryRetry(
  ctx: ActionCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  return ctx.scheduler.runAfter(
    ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS,
    recoverAccountDeletionReference,
    { authId, expectedPreparation }
  );
}
