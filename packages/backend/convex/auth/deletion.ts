import { query } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { cancelAccountDeletionAttemptByToken } from "@repo/backend/convex/auth/deletion/attemptCancellation";
import {
  cancelAccountDeletionBatch,
  sweepAccountDeletionCancellationsProgram,
} from "@repo/backend/convex/auth/deletion/cancel";
import { claimAccountDeletion as claimAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/claim";
import { continueAccountDeletionCommitProgram } from "@repo/backend/convex/auth/deletion/commit";
import { ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE } from "@repo/backend/convex/auth/deletion/constants";
import { prepareAccountDeletion as prepareAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/prepare";
import {
  getAccountDeletionAttemptStatusProgram,
  sweepAccountDeletionReceiptsProgram,
} from "@repo/backend/convex/auth/deletion/receipt";
import {
  AccountDeletionCancellationUnprovenError,
  accountDeletionAttemptStatusValidator,
  accountDeletionCancellationOutcomeValidator,
  accountDeletionPreparationOutcomeValidator,
  accountDeletionPreparationVersionValidator,
} from "@repo/backend/convex/auth/deletion/spec";
import { authReader } from "@repo/backend/convex/auth/reader";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const sweepAccountDeletionRetentionReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("auth/deletion:sweepAccountDeletionRetention");

/** Claims the irreversible phase after reserving every school successor. */
export const claimAccountDeletion = internalMutation({
  args: {
    attemptId: v.string(),
    authId: v.string(),
  },
  returns: accountDeletionPreparationOutcomeValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      claimAccountDeletionProgram(ctx, args.authId, args.attemptId)
    ),
});

/** Continues one bounded, already-claimed Better Auth deletion transaction. */
export const continueAccountDeletionCommit = internalMutation({
  args: {
    authId: v.string(),
    expectedPreparation: accountDeletionPreparationVersionValidator,
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      continueAccountDeletionCommitProgram(
        ctx,
        args.authId,
        args.expectedPreparation
      )
    ),
});

/** Advances one bounded preparation step for the current browser attempt. */
export const prepareCurrentAccountDeletion = mutation({
  args: {
    attemptId: v.string(),
  },
  returns: accountDeletionPreparationOutcomeValidator,
  handler: async (ctx, args) => {
    const authUser = await authReader.getAuthUser(ctx);

    return await runConvexProgram(
      prepareAccountDeletionProgram(ctx, authUser._id, args.attemptId)
    );
  },
});

/** Cancels one versioned recovery batch and schedules any continuation. */
export const cancelAccountDeletion = internalMutation({
  args: {
    authId: v.string(),
    expectedPreparation: accountDeletionPreparationVersionValidator,
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      cancelAccountDeletionBatch(ctx, args.authId, args.expectedPreparation)
    ),
});

/** Lets the opaque browser attempt recover while its auth user still exists. */
export const cancelAccountDeletionAttempt = mutation({
  args: {
    attemptId: v.string(),
  },
  returns: accountDeletionCancellationOutcomeValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      cancelAccountDeletionAttemptByToken(
        ctx,
        args.attemptId,
        async (authId) =>
          (await authReader.getAnyUserById(ctx, authId)) !== null
      ).pipe(
        Effect.flatMap((outcome) =>
          outcome === null
            ? Effect.fail(
                new AccountDeletionCancellationUnprovenError({
                  code: ACCOUNT_DELETION_CANCELLATION_UNPROVEN_CODE,
                  message: "Account deletion cancellation could not be proven.",
                })
              )
            : Effect.succeed(outcome)
        )
      )
    ),
});

/** Proves whether one opaque browser deletion attempt committed. */
export const getAccountDeletionAttemptStatus = query({
  args: {
    attemptId: v.string(),
  },
  returns: accountDeletionAttemptStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      getAccountDeletionAttemptStatusProgram(
        ctx,
        args.attemptId,
        async (authId) =>
          (await authReader.getAnyUserById(ctx, authId)) !== null
      )
    ),
});

/** Removes expired privacy-minimal attempt artifacts in bounded pages. */
export const sweepAccountDeletionRetention = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const hasMoreCancellations =
          yield* sweepAccountDeletionCancellationsProgram(ctx);
        const hasMoreReceipts = yield* sweepAccountDeletionReceiptsProgram(ctx);

        if (hasMoreCancellations || hasMoreReceipts) {
          yield* tryUserCleanup(() =>
            ctx.scheduler.runAfter(
              0,
              sweepAccountDeletionRetentionReference,
              {}
            )
          );
        }
      }).pipe(Effect.as(null))
    ),
});
