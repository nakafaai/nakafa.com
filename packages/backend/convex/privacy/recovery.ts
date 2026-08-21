import {
  vWorkflowId,
  type WorkflowId,
  type WorkflowStatus,
} from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  type CleanupSource,
  cleanupSourceValidator,
  type PrivacyCleanupError,
  tryPrivacyCleanup,
} from "@repo/backend/convex/privacy/spec";
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
  workflowId: WorkflowId,
  source: CleanupSource
) => Promise<unknown>;
type CleanupWorkflowStorage = (
  ctx: MutationCtx,
  workflowId: WorkflowId
) => Promise<unknown>;

/** Restarts an idempotent privacy workflow after a recoverable terminal state. */
export const retryCleanupWorkflowProgram: (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  source: CleanupSource,
  getStatus?: GetCleanupWorkflowStatus,
  restartWorkflow?: RestartCleanupWorkflow,
  scheduleRecovery?: ScheduleCleanupRecovery
) => Effect.Effect<void, PrivacyCleanupError> = Effect.fn(
  "privacy.retryCleanupWorkflow"
)(function* (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  source: CleanupSource,
  getStatus: GetCleanupWorkflowStatus = (workflowCtx, id) =>
    workflow.status(workflowCtx, id),
  restartWorkflow: RestartCleanupWorkflow = (workflowCtx, id, options) =>
    workflow.restart(workflowCtx, id, options),
  scheduleRecovery: ScheduleCleanupRecovery = (
    workflowCtx,
    id,
    cleanupSourceName
  ) =>
    workflowCtx.scheduler.runAfter(
      WORKFLOW_RECOVERY_DELAY_MS,
      internal.privacy.recovery.retryCleanupWorkflow,
      { source: cleanupSourceName, workflowId: id }
    )
) {
  const recoverFailedWorkflow = Effect.gen(function* () {
    const status = yield* tryPrivacyCleanup(() => getStatus(ctx, workflowId));
    if (status.type !== "failed" && status.type !== "canceled") {
      return;
    }
    yield* tryPrivacyCleanup(() =>
      restartWorkflow(ctx, workflowId, { from: 0, startAsync: true })
    );
  });
  yield* recoverFailedWorkflow.pipe(
    Effect.catchTag("PrivacyCleanupError", (error) =>
      Effect.logError("Privacy cleanup recovery attempt failed").pipe(
        Effect.annotateLogs({
          error: error.message,
          source,
          workflowId,
        }),
        Effect.andThen(
          tryPrivacyCleanup(() => scheduleRecovery(ctx, workflowId, source))
        )
      )
    )
  );
});

/** Retries one retained privacy workflow after its recovery delay. */
export const retryCleanupWorkflow = internalMutation({
  args: {
    source: cleanupSourceValidator,
    workflowId: vWorkflowId,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      retryCleanupWorkflowProgram(ctx, args.workflowId, args.source)
    );
    return null;
  },
});

/** Retains incomplete privacy journals and releases successful ones. */
export const handleCleanupComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ source: cleanupSourceValidator }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      await ctx.scheduler.runAfter(
        0,
        internal.privacy.recovery.cleanupWorkflowStorage,
        { source: args.context.source, workflowId: args.workflowId }
      );
      return null;
    }
    logger.error("Privacy cleanup workflow requires recovery", {
      resultKind: args.result.kind,
      source: args.context.source,
      workflowId: args.workflowId,
    });
    if (args.result.kind === "failed" || args.result.kind === "canceled") {
      await runConvexProgram(
        tryPrivacyCleanup(() =>
          ctx.scheduler.runAfter(
            WORKFLOW_RECOVERY_DELAY_MS,
            internal.privacy.recovery.retryCleanupWorkflow,
            { source: args.context.source, workflowId: args.workflowId }
          )
        )
      );
    }
    return null;
  },
});

/** Retries journal release until the workflow component accepts cleanup. */
export const cleanupWorkflowStorageProgram: (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  source: CleanupSource,
  cleanupStorage?: CleanupWorkflowStorage,
  scheduleRecovery?: ScheduleCleanupRecovery
) => Effect.Effect<void, PrivacyCleanupError> = Effect.fn(
  "privacy.cleanupWorkflowStorage"
)(function* (
  ctx: MutationCtx,
  workflowId: WorkflowId,
  source: CleanupSource,
  cleanupStorage: CleanupWorkflowStorage = (workflowCtx, id) =>
    workflow.cleanup(workflowCtx, id),
  scheduleRecovery: ScheduleCleanupRecovery = (
    workflowCtx,
    id,
    cleanupSourceName
  ) =>
    workflowCtx.scheduler.runAfter(
      WORKFLOW_RECOVERY_DELAY_MS,
      internal.privacy.recovery.cleanupWorkflowStorage,
      { source: cleanupSourceName, workflowId: id }
    )
) {
  yield* tryPrivacyCleanup(() => cleanupStorage(ctx, workflowId)).pipe(
    Effect.catchTag("PrivacyCleanupError", (error) =>
      Effect.logError("Privacy workflow journal cleanup failed").pipe(
        Effect.annotateLogs({
          error: error.message,
          source,
          workflowId,
        }),
        Effect.andThen(
          tryPrivacyCleanup(() => scheduleRecovery(ctx, workflowId, source))
        )
      )
    )
  );
});

/** Releases a completed privacy workflow journal with durable retries. */
export const cleanupWorkflowStorage = internalMutation({
  args: {
    source: cleanupSourceValidator,
    workflowId: vWorkflowId,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      cleanupWorkflowStorageProgram(ctx, args.workflowId, args.source)
    );
    return null;
  },
});
