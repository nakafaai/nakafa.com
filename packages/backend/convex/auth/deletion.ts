import {
  type MutationCtx,
  query,
} from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import {
  cancelAccountDeletionAttemptBatch,
  cancelAccountDeletionAttemptByToken,
  cancelAccountDeletion as cancelAccountDeletionProgram,
} from "@repo/backend/convex/auth/deletion/cancel";
import { claimAccountDeletion as claimAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/claim";
import { continueAccountDeletionCommitProgram } from "@repo/backend/convex/auth/deletion/commit";
import { prepareAccountDeletion as prepareAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/prepare";
import {
  getAccountDeletionAttemptStatusProgram,
  sweepAccountDeletionReceiptsProgram,
} from "@repo/backend/convex/auth/deletion/receipt";
import {
  type AccountDeletionPreparationVersion,
  accountDeletionAttemptStatusValidator,
  accountDeletionPreparationOutcomeValidator,
  accountDeletionPreparationVersionValidator,
} from "@repo/backend/convex/auth/deletion/spec";
import { authReader } from "@repo/backend/convex/auth/reader";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const cancelAccountDeletionReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation: AccountDeletionPreparationVersion;
  },
  boolean
>("auth/deletion:cancelAccountDeletion");
const sweepAccountDeletionReceiptsReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("auth/deletion:sweepAccountDeletionReceipts");

const cancelAccountDeletionRecoveryBatch = Effect.fn(
  "auth.deletion.cancelAccountDeletionRecoveryBatch"
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  const hasMore = yield* cancelAccountDeletionProgram(
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
      cancelAccountDeletionRecoveryBatch(
        ctx,
        args.authId,
        args.expectedPreparation
      )
    ),
});

/** Continues bounded reservation cleanup after the browser has recovered. */
export const continueAccountDeletionCancellation = internalMutation({
  args: {
    attemptId: v.string(),
    authId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      cancelAccountDeletionAttemptBatch(ctx, args.authId, args.attemptId)
    );
    return null;
  },
});

/** Lets the opaque browser attempt recover while its auth user still exists. */
export const cancelAccountDeletionAttempt = mutation({
  args: {
    attemptId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      cancelAccountDeletionAttemptByToken(
        ctx,
        args.attemptId,
        async (authId) =>
          (await authReader.getAnyUserById(ctx, authId)) !== null
      )
    );
    return null;
  },
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

/** Removes expired privacy-minimal deletion receipts in bounded pages. */
export const sweepAccountDeletionReceipts = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const hasMore = yield* sweepAccountDeletionReceiptsProgram(ctx);

        if (hasMore) {
          yield* tryUserCleanup(() =>
            ctx.scheduler.runAfter(0, sweepAccountDeletionReceiptsReference, {})
          );
        }
      }).pipe(Effect.as(null))
    ),
});
