import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import {
  cancelAccountDeletionAttempt,
  cancelAccountDeletion as cancelAccountDeletionProgram,
} from "@repo/backend/convex/auth/deletion/cancel";
import { prepareAccountDeletion as prepareAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/prepare";
import {
  accountDeletionPreparationOutcomeValidator,
  accountDeletionPreparationVersionValidator,
} from "@repo/backend/convex/auth/deletion/spec";
import { authReader } from "@repo/backend/convex/auth/reader";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const continueAccountDeletionCancellationReference = makeFunctionReference<
  "mutation",
  { attemptId: string; authId: string },
  null
>("auth/deletion:continueAccountDeletionCancellation");

const cancelAccountDeletionAttemptBatch = Effect.fn(
  "auth.deletion.cancelAccountDeletionAttemptBatch"
)(function* (ctx: MutationCtx, authId: string, attemptId: string) {
  const hasMore = yield* cancelAccountDeletionAttempt(ctx, authId, attemptId);

  if (hasMore) {
    yield* tryUserCleanup(() =>
      ctx.scheduler.runAfter(0, continueAccountDeletionCancellationReference, {
        attemptId,
        authId,
      })
    );
  }
});

/** Reserves every owned school's successor before auth deletion. */
export const prepareAccountDeletion = internalMutation({
  args: {
    attemptId: v.string(),
    authId: v.string(),
  },
  returns: accountDeletionPreparationOutcomeValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      prepareAccountDeletionProgram(ctx, args.authId, args.attemptId)
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

/** Cancels one exact prepared deletion during durable recovery. */
export const cancelAccountDeletion = internalMutation({
  args: {
    authId: v.string(),
    expectedPreparation: accountDeletionPreparationVersionValidator,
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      cancelAccountDeletionProgram(ctx, args.authId, args.expectedPreparation)
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

/** Lets the current auth session immediately recover from an aborted delete. */
export const cancelCurrentAccountDeletion = mutation({
  args: {
    attemptId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await authReader.getAuthUser(ctx);

    await runConvexProgram(
      cancelAccountDeletionAttemptBatch(ctx, authUser._id, args.attemptId)
    );
    return null;
  },
});
