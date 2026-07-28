import {
  vWorkflowId,
  type WorkflowId,
  type WorkflowStatus,
} from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { Effect } from "effect";

const WORKFLOW_RECOVERY_DELAY_MS = 60 * 60 * 1000;

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
      internal.customers.deletion.recovery.retryDeletedUserCleanup,
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
        internal.customers.deletion.recovery.cleanupDeletedUserWorkflowStorage,
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
            internal.customers.deletion.recovery.retryDeletedUserCleanup,
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
      internal.customers.deletion.recovery.cleanupDeletedUserWorkflowStorage,
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
