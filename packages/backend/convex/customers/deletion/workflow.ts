import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { finalizeAccountDeletion } from "@repo/backend/convex/auth/deletion/finalize";
import { accountDeletionPreparationVersionValidator } from "@repo/backend/convex/auth/deletion/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

type StartCleanupWorkflow = (
  ctx: MutationCtx,
  identity: {
    readonly authId: string;
    readonly userId: Id<"users">;
  }
) => Promise<unknown>;

interface CleanupWorkflowStarters {
  readonly startAnalytics: StartCleanupWorkflow;
  readonly startAuth: StartCleanupWorkflow;
  readonly startCustomer: StartCleanupWorkflow;
  readonly startData: StartCleanupWorkflow;
}

const cleanupWorkflowStarters: CleanupWorkflowStarters = {
  startAnalytics: (ctx, identity) =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserAnalytics,
      { userId: identity.userId },
      {
        context: {},
        onComplete:
          internal.customers.deletion.recovery.handleDeletedUserCleanupComplete,
      }
    ),
  startAuth: (ctx, identity) =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserAuth,
      { authId: identity.authId },
      {
        context: {},
        onComplete:
          internal.customers.deletion.recovery.handleDeletedUserCleanupComplete,
      }
    ),
  startCustomer: (ctx, identity) =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserCustomer,
      identity,
      {
        context: {},
        onComplete:
          internal.customers.deletion.recovery.handleDeletedUserCleanupComplete,
      }
    ),
  startData: (ctx, identity) =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserData,
      { userId: identity.userId },
      {
        context: {},
        onComplete:
          internal.customers.deletion.recovery.handleDeletedUserCleanupComplete,
      }
    ),
};

/** Atomically admits independent auth, analytics, customer, and data workflows. */
export const launchDeletedUserCleanupProgram: (
  ctx: MutationCtx,
  authId: string,
  userId: Id<"users">,
  starters?: CleanupWorkflowStarters
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "customers.deletion.launchDeletedUserCleanup"
)(function* (
  ctx: MutationCtx,
  authId: string,
  userId: Id<"users">,
  starters: CleanupWorkflowStarters = cleanupWorkflowStarters
) {
  const user = yield* tryUserCleanup(() => ctx.db.get("users", userId));

  if (
    !user ||
    user.deletedAt === undefined ||
    user.deletionCleanupStartedAt !== undefined
  ) {
    return;
  }

  const cleanupStartedAt = yield* Clock.currentTimeMillis;
  const identity = {
    authId,
    userId: user._id,
  };

  yield* tryUserCleanup(() => starters.startAnalytics(ctx, identity));
  yield* tryUserCleanup(() => starters.startAuth(ctx, identity));
  yield* tryUserCleanup(() => starters.startCustomer(ctx, identity));
  yield* tryUserCleanup(() => starters.startData(ctx, identity));
  yield* tryUserCleanup(() =>
    ctx.db.patch("users", user._id, {
      deletionCleanupStartedAt: cleanupStartedAt,
    })
  );
});

/** Finalizes app state after the Better Auth user transaction commits. */
export const finalizeDeletedUserCleanup = internalMutation({
  args: {
    authId: v.string(),
    expectedPreparation: v.optional(accountDeletionPreparationVersionValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      finalizeAccountDeletion(ctx, args.authId, args.expectedPreparation)
    );
    return null;
  },
});

/** Starts durable personal-data cleanup after app finalization commits. */
export const launchDeletedUserCleanup = internalMutation({
  args: {
    authId: v.string(),
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      launchDeletedUserCleanupProgram(ctx, args.authId, args.userId)
    );
    return null;
  },
});
