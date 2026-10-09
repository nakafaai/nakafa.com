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
export type StartCleanupWorkflow = (identity: {
  readonly authId: string;
  readonly userId: Id<"users">;
}) => Effect.Effect<unknown, UserCleanupError, MutationCtxService>;
const startAnalytics: StartCleanupWorkflow = Effect.fn(
  "customers.deletion.startAnalytics"
)(function* (identity: Parameters<StartCleanupWorkflow>[0]) {
  const ctx = yield* MutationCtxService;
  return yield* tryUserCleanup(() =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserAnalytics,
      {
        userId: identity.userId,
      },
      {
        context: {
          source: cleanupSource.accountDeletion,
        },
        onComplete: internal.privacy.recovery.handleCleanupComplete,
      }
    )
  );
});
const startAuth: StartCleanupWorkflow = Effect.fn(
  "customers.deletion.startAuth"
)(function* (identity: Parameters<StartCleanupWorkflow>[0]) {
  const ctx = yield* MutationCtxService;
  return yield* tryUserCleanup(() =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserAuth,
      identity,
      {
        context: {
          source: cleanupSource.accountDeletion,
        },
        onComplete: internal.privacy.recovery.handleCleanupComplete,
      }
    )
  );
});
const startCustomer: StartCleanupWorkflow = Effect.fn(
  "customers.deletion.startCustomer"
)(function* (identity: Parameters<StartCleanupWorkflow>[0]) {
  const ctx = yield* MutationCtxService;
  return yield* tryUserCleanup(() =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserCustomer,
      identity,
      {
        context: {
          source: cleanupSource.accountDeletion,
        },
        onComplete: internal.privacy.recovery.handleCleanupComplete,
      }
    )
  );
});
const startData: StartCleanupWorkflow = Effect.fn(
  "customers.deletion.startData"
)(function* (identity: Parameters<StartCleanupWorkflow>[0]) {
  const ctx = yield* MutationCtxService;
  return yield* tryUserCleanup(() =>
    workflow.start(
      ctx,
      internal.customers.deletion.cleanup.cleanupDeletedUserData,
      {
        userId: identity.userId,
      },
      {
        context: {
          source: cleanupSource.accountDeletion,
        },
        onComplete: internal.privacy.recovery.handleCleanupComplete,
      }
    )
  );
});
const cleanupWorkflowStarters = {
  startAnalytics,
  startAuth,
  startCustomer,
  startData,
};
type CleanupWorkflowStarters = typeof cleanupWorkflowStarters;

/** Atomically admits independent auth, analytics, customer, and data workflows. */
export const launchDeletedUserCleanupProgram = Effect.fn(
  "customers.deletion.launchDeletedUserCleanup"
)(
  function* (
    authId: string,
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
    const identity = {
      authId,
      userId: user._id,
    };
    yield* starters.startAnalytics(identity);
    yield* starters.startAuth(identity);
    yield* starters.startCustomer(identity);
    yield* starters.startData(identity);
    yield* writer
      .table("users")
      .patch(user._id, {
        deletionCleanupStartedAt: cleanupStartedAt,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
