import {
  vWorkflowId,
  type WorkflowId,
  type WorkflowStatus,
} from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { POSTHOG_DELETION_RECONCILIATION_DELAY_MS } from "@repo/backend/convex/analytics/deletion";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { finalizeAccountDeletion } from "@repo/backend/convex/auth/deletion/finalize";
import { accountDeletionPreparationVersionValidator } from "@repo/backend/convex/auth/deletion/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

const DELETED_USER_CLEANUP_RETRY = {
  maxAttempts: 10,
  initialBackoffMs: 1000,
  base: 2,
};
const WORKFLOW_RECOVERY_DELAY_MS = 60 * 60 * 1000;

type StartCleanupWorkflow = (
  ctx: MutationCtx,
  identity: {
    readonly authId: string;
    readonly userId: Id<"users">;
  }
) => Promise<unknown>;

interface CleanupWorkflowStarters {
  readonly startAnalytics: StartCleanupWorkflow;
  readonly startData: StartCleanupWorkflow;
}

const cleanupWorkflowStarters: CleanupWorkflowStarters = {
  startAnalytics: (ctx, identity) =>
    workflow.start(
      ctx,
      internal.customers.deletion.workflow.cleanupDeletedUserAnalytics,
      { userId: identity.userId },
      {
        context: {},
        onComplete:
          internal.customers.deletion.workflow.handleDeletedUserCleanupComplete,
      }
    ),
  startData: (ctx, identity) =>
    workflow.start(
      ctx,
      internal.customers.deletion.workflow.cleanupDeletedUserData,
      identity,
      {
        context: {},
        onComplete:
          internal.customers.deletion.workflow.handleDeletedUserCleanupComplete,
      }
    ),
};

type GetCleanupWorkflowStatus = (
  ctx: MutationCtx,
  workflowId: WorkflowId
) => Promise<WorkflowStatus>;

type RestartCleanupWorkflow = (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  options: {
    readonly from: 0;
    readonly startAsync: true;
  }
) => Promise<void>;

type ScheduleCleanupRecovery = (
  ctx: MutationCtx,
  workflowId: WorkflowId
) => Promise<unknown>;

type CleanupWorkflowStorage = (
  ctx: MutationCtx,
  workflowId: WorkflowId
) => Promise<unknown>;

/** Atomically admits independent analytics and app-data cleanup workflows. */
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

/** Erases analytics independently from every local and external data drain. */
export const cleanupDeletedUserAnalytics = workflow.define({
  args: {
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.analytics.deletion.cleanupDeletedUserAnalytics,
      { userId: args.userId },
      { retry: DELETED_USER_CLEANUP_RETRY }
    );
    await step.runAction(
      internal.analytics.deletion.cleanupDeletedUserAnalytics,
      { userId: args.userId },
      {
        name: "reconcile late analytics writes",
        retry: DELETED_USER_CLEANUP_RETRY,
        runAfter: POSTHOG_DELETION_RECONCILIATION_DELAY_MS,
      }
    );

    return null;
  },
});

/** Runs every retry-safe customer and app-data cleanup step in durable order. */
export const cleanupDeletedUserData = workflow.define({
  args: {
    authId: v.string(),
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.customers.actions.internal.cleanupDeletedUserCustomerData,
      {
        authId: args.authId,
        userId: args.userId,
      },
      { retry: DELETED_USER_CLEANUP_RETRY }
    );
    await step.runAction(
      internal.auth.cleanup.drainDeletedUserData,
      { userId: args.userId },
      { retry: DELETED_USER_CLEANUP_RETRY }
    );

    return null;
  },
});

/** Restarts every idempotent cleanup step after a recoverable terminal state. */
export const retryDeletedUserCleanupProgram: (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  getStatus?: GetCleanupWorkflowStatus,
  restartWorkflow?: RestartCleanupWorkflow,
  scheduleRecovery?: ScheduleCleanupRecovery
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "customers.deletion.retryDeletedUserCleanup"
)(function* (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  getStatus: GetCleanupWorkflowStatus = (workflowCtx, id) =>
    workflow.status(workflowCtx, id),
  restartWorkflow: RestartCleanupWorkflow = (workflowCtx, id, options) =>
    workflow.restart(workflowCtx, id, options),
  scheduleRecovery: ScheduleCleanupRecovery = (workflowCtx, id) =>
    workflowCtx.scheduler.runAfter(
      WORKFLOW_RECOVERY_DELAY_MS,
      internal.customers.deletion.workflow.retryDeletedUserCleanup,
      { workflowId: id }
    )
) {
  const recoverFailedWorkflow = Effect.gen(function* () {
    const status = yield* tryUserCleanup(() => getStatus(ctx, workflowId));

    if (status.type !== "failed" && status.type !== "canceled") {
      return;
    }

    yield* tryUserCleanup(() =>
      restartWorkflow(ctx, workflowId, { from: 0, startAsync: true })
    );
  });

  yield* recoverFailedWorkflow.pipe(
    Effect.catchTag("UserCleanupError", (error) =>
      Effect.logError("Deleted-user cleanup recovery attempt failed").pipe(
        Effect.annotateLogs({
          error: error.message,
          workflowId,
        }),
        Effect.zipRight(tryUserCleanup(() => scheduleRecovery(ctx, workflowId)))
      )
    )
  );
});

/** Retries one retained recoverable workflow after its recovery delay. */
export const retryDeletedUserCleanup = internalMutation({
  args: {
    workflowId: vWorkflowId,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      retryDeletedUserCleanupProgram(ctx, args.workflowId)
    );
    return null;
  },
});

/** Retains incomplete cleanup journals and releases successful ones. */
export const handleDeletedUserCleanupComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({}),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      await ctx.scheduler.runAfter(
        0,
        internal.customers.deletion.workflow.cleanupDeletedUserWorkflowStorage,
        { workflowId: args.workflowId }
      );
      return null;
    }

    logger.error("Deleted-user cleanup workflow requires recovery", {
      resultKind: args.result.kind,
      workflowId: args.workflowId,
    });

    if (args.result.kind === "failed" || args.result.kind === "canceled") {
      await runConvexProgram(
        tryUserCleanup(() =>
          ctx.scheduler.runAfter(
            WORKFLOW_RECOVERY_DELAY_MS,
            internal.customers.deletion.workflow.retryDeletedUserCleanup,
            { workflowId: args.workflowId }
          )
        )
      );
    }

    return null;
  },
});

/** Retries journal release until the component accepts the cleanup. */
export const cleanupDeletedUserWorkflowStorageProgram: (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  cleanupStorage?: CleanupWorkflowStorage,
  scheduleRecovery?: ScheduleCleanupRecovery
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "customers.deletion.cleanupDeletedUserWorkflowStorage"
)(function* (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  cleanupStorage: CleanupWorkflowStorage = (workflowCtx, id) =>
    workflow.cleanup(workflowCtx, id),
  scheduleRecovery: ScheduleCleanupRecovery = (workflowCtx, id) =>
    workflowCtx.scheduler.runAfter(
      WORKFLOW_RECOVERY_DELAY_MS,
      internal.customers.deletion.workflow.cleanupDeletedUserWorkflowStorage,
      { workflowId: id }
    )
) {
  yield* tryUserCleanup(() => cleanupStorage(ctx, workflowId)).pipe(
    Effect.catchTag("UserCleanupError", (error) =>
      Effect.logError("Deleted-user workflow journal cleanup failed").pipe(
        Effect.annotateLogs({
          error: error.message,
          workflowId,
        }),
        Effect.zipRight(tryUserCleanup(() => scheduleRecovery(ctx, workflowId)))
      )
    )
  );
});

/** Releases the journal after completion and retries transient failures. */
export const cleanupDeletedUserWorkflowStorage = internalMutation({
  args: {
    workflowId: vWorkflowId,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      cleanupDeletedUserWorkflowStorageProgram(ctx, args.workflowId)
    );
    return null;
  },
});
