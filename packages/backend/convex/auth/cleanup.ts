import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { cleanupDeletedUserProgram } from "@repo/backend/convex/auth/cleanup/impl";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const cleanupDeletedUserReference = makeFunctionReference<
  "mutation",
  { userId: Id<"users"> },
  boolean
>("auth/cleanup:cleanupDeletedUser");

/** Drains persisted cleanup batches without growing the workflow journal. */
export const drainDeletedUserDataProgram = Effect.fn(
  "auth.cleanup.drainDeletedUserData"
)(function* (cleanupBatch: () => Promise<boolean>) {
  let hasMore = true;

  while (hasMore) {
    hasMore = yield* tryUserCleanup(cleanupBatch);
  }
});

/** Deletes one user's local app data after the auth account is removed. */
export const cleanupDeletedUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(cleanupDeletedUserProgram(ctx, args.userId)),
});

/**
 * Drains bounded mutations from an action step. If the action is interrupted,
 * the workflow retry resumes from the already-committed remaining data.
 */
export const drainDeletedUserData = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      drainDeletedUserDataProgram(() =>
        ctx.runMutation(cleanupDeletedUserReference, {
          userId: args.userId,
        })
      )
    );

    return null;
  },
});
