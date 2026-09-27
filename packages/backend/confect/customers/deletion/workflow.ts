import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  toUserCleanupError,
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import { cleanupSource } from "@repo/backend/confect/privacy/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Effect, flow } from "effect";
export type StartCleanupWorkflow = (
  ctx: MutationCtx,
  identity: {
    readonly authId: string;
    readonly userId: Id<"users">;
  }
) => Effect.Effect<unknown, UserCleanupError>;
export interface CleanupWorkflowStarters {
  readonly startAnalytics: StartCleanupWorkflow;
  readonly startAuth: StartCleanupWorkflow;
  readonly startCustomer: StartCleanupWorkflow;
  readonly startData: StartCleanupWorkflow;
}
export const cleanupWorkflowStarters: CleanupWorkflowStarters = {
  startAnalytics: Effect.fn("customers.deletion.startAnalytics")(
    (ctx: MutationCtx, identity: Parameters<StartCleanupWorkflow>[1]) =>
      tryUserCleanup(() =>
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
      )
  ),
  startAuth: Effect.fn("customers.deletion.startAuth")(
    (ctx: MutationCtx, identity: Parameters<StartCleanupWorkflow>[1]) =>
      tryUserCleanup(() =>
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
      )
  ),
  startCustomer: Effect.fn("customers.deletion.startCustomer")(
    (ctx: MutationCtx, identity: Parameters<StartCleanupWorkflow>[1]) =>
      tryUserCleanup(() =>
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
      )
  ),
  startData: Effect.fn("customers.deletion.startData")(
    (ctx: MutationCtx, identity: Parameters<StartCleanupWorkflow>[1]) =>
      tryUserCleanup(() =>
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
      )
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
)(
  function* (
    ctx: MutationCtx,
    authId: string,
    userId: Id<"users">,
    starters: CleanupWorkflowStarters = cleanupWorkflowStarters
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
    yield* starters.startAnalytics(ctx, identity);
    yield* starters.startAuth(ctx, identity);
    yield* starters.startCustomer(ctx, identity);
    yield* starters.startData(ctx, identity);
    yield* writer
      .table("users")
      .patch(user._id, {
        deletionCleanupStartedAt: cleanupStartedAt,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
