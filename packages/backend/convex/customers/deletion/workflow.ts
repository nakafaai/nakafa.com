import {
  vWorkflowId,
  type WorkflowId,
  type WorkflowStatus,
} from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

const EXTERNAL_DELETE_RETRY = {
  maxAttempts: 10,
  initialBackoffMs: 1000,
  base: 2,
};
const FAILED_WORKFLOW_RECOVERY_DELAY_MS = 60 * 60 * 1000;

type StartCleanupWorkflow = (
  ctx: MutationCtx,
  identity: {
    readonly authId: string;
    readonly userId: Id<"users">;
  }
) => Promise<unknown>;

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

/** Resolves a deleted auth identity and starts its durable cleanup workflow. */
export const startDeletedUserCleanupProgram: (
  ctx: MutationCtx,
  authId: string,
  startWorkflow?: StartCleanupWorkflow
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "customers.deletion.startDeletedUserCleanup"
)(function* (
  ctx: MutationCtx,
  authId: string,
  startWorkflow: StartCleanupWorkflow = (workflowCtx, identity) =>
    workflow.start(
      workflowCtx,
      internal.customers.deletion.workflow.cleanupDeletedUserData,
      identity,
      {
        context: {},
        onComplete:
          internal.customers.deletion.workflow.handleDeletedUserCleanupComplete,
      }
    )
) {
  const user = yield* tryUserCleanup(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (!user) {
    return;
  }

  const deletedAt = yield* Clock.currentTimeMillis;

  yield* tryUserCleanup(() =>
    ctx.db.patch("users", user._id, {
      deletedAt,
    })
  );
  yield* tryUserCleanup(() =>
    startWorkflow(ctx, {
      authId,
      userId: user._id,
    })
  );
});

/** Starts durable cleanup after the Better Auth user transaction commits. */
export const startDeletedUserCleanup = internalMutation({
  args: {
    authId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(startDeletedUserCleanupProgram(ctx, args.authId));
    return null;
  },
});

/**
 * Cancels billing and starts external erasure before local cleanup. This keeps
 * deterministic local corruption from leaving paid service or analytics data
 * active after the auth identity is gone. Every step is retry-safe.
 */
export const cleanupDeletedUserData = workflow.define({
  args: {
    authId: v.string(),
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.customers.actions.internal.cleanupUserData,
      args,
      { retry: EXTERNAL_DELETE_RETRY }
    );
    await step.runAction(
      internal.analytics.deletion.cleanupDeletedUserAnalytics,
      { userId: args.userId },
      { retry: EXTERNAL_DELETE_RETRY }
    );

    let hasMoreLocalData = true;

    while (hasMoreLocalData) {
      hasMoreLocalData = await step.runMutation(
        internal.auth.cleanup.cleanupDeletedUser,
        { userId: args.userId }
      );
    }

    return null;
  },
});

/** Restarts every idempotent cleanup step after a retained workflow failure. */
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
      FAILED_WORKFLOW_RECOVERY_DELAY_MS,
      internal.customers.deletion.workflow.retryDeletedUserCleanup,
      { workflowId: id }
    )
) {
  const recoverFailedWorkflow = Effect.gen(function* () {
    const status = yield* tryUserCleanup(() => getStatus(ctx, workflowId));

    if (status.type !== "failed") {
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

/** Retries one retained failed workflow after its recovery delay. */
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

/**
 * Retains and retries failed cleanup journals, and releases successful ones.
 */
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

    if (args.result.kind === "failed") {
      await runConvexProgram(
        tryUserCleanup(() =>
          ctx.scheduler.runAfter(
            FAILED_WORKFLOW_RECOVERY_DELAY_MS,
            internal.customers.deletion.workflow.retryDeletedUserCleanup,
            { workflowId: args.workflowId }
          )
        )
      );
    }

    return null;
  },
});

/** Releases the journal only after the completion callback has returned. */
export const cleanupDeletedUserWorkflowStorage = internalMutation({
  args: {
    workflowId: vWorkflowId,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await workflow.cleanup(ctx, args.workflowId);
    return null;
  },
});
