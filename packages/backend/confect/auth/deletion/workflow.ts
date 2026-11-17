import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import { cleanupSource } from "@repo/backend/confect/privacy/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Clock, Effect, flow } from "effect";
export type StartCleanupWorkflow = (
  userId: Id<"users">
) => Effect.Effect<unknown, UserCleanupError, MutationCtxService>;
const startAnalytics: StartCleanupWorkflow = Effect.fn(
  "auth.deletion.startAnalytics"
)(function* (userId: Parameters<StartCleanupWorkflow>[0]) {
  const ctx = yield* MutationCtxService;
  return yield* tryUserCleanup(() =>
    workflow.start(
      ctx,
      internal.auth.deletion.cleanup.cleanupDeletedUserAnalytics,
      { userId },
      {
        context: {
          source: cleanupSource.accountDeletion,
        },
        onComplete: internal.privacy.recovery.handleCleanupComplete,
      }
    )
  );
});
const startBilling: StartCleanupWorkflow = Effect.fn(
  "auth.deletion.startBilling"
)(function* (userId: Parameters<StartCleanupWorkflow>[0]) {
  const ctx = yield* MutationCtxService;
  return yield* tryUserCleanup(() =>
    workflow.start(
      ctx,
      internal.auth.deletion.cleanup.cleanupDeletedUserBilling,
      { userId },
      {
        context: {
          source: cleanupSource.accountDeletion,
        },
        onComplete: internal.privacy.recovery.handleCleanupComplete,
      }
    )
  );
});
const startData: StartCleanupWorkflow = Effect.fn("auth.deletion.startData")(
  function* (userId: Parameters<StartCleanupWorkflow>[0]) {
    const ctx = yield* MutationCtxService;
    return yield* tryUserCleanup(() =>
      workflow.start(
        ctx,
        internal.auth.deletion.cleanup.cleanupDeletedUserData,
        { userId },
        {
          context: {
            source: cleanupSource.accountDeletion,
          },
          onComplete: internal.privacy.recovery.handleCleanupComplete,
        }
      )
    );
  }
);
const cleanupWorkflowStarters = {
  startAnalytics,
  startBilling,
  startData,
};
type CleanupWorkflowStarters = typeof cleanupWorkflowStarters;

/** Atomically admits independent analytics, customer, and data workflows. */
export const launchDeletedUserCleanupProgram = Effect.fn(
  "auth.deletion.launchDeletedUserCleanup"
)(
  function* (
    userId: Id<"users">,
    starters: CleanupWorkflowStarters = cleanupWorkflowStarters
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* database
      .table("users")
      .get(userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !user ||
      user.deletedAt === undefined ||
      user.deletionCleanupStartedAt !== undefined
    ) {
      return;
    }
    const cleanupStartedAt = yield* Clock.currentTimeMillis;
    yield* starters.startAnalytics(user._id);
    yield* starters.startBilling(user._id);
    yield* starters.startData(user._id);
    yield* writer
      .table("users")
      .patch(user._id, {
        deletionCleanupStartedAt: cleanupStartedAt,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
