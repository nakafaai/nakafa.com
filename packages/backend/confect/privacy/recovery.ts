import type { WorkflowId } from "@convex-dev/workflow";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationCtx as MutationCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  type CleanupSource,
  toPrivacyCleanupError,
  tryPrivacyCleanup,
} from "@repo/backend/confect/privacy/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { Duration, Effect, flow } from "effect";
export const WORKFLOW_RECOVERY_DELAY_MS = 60 * 60 * 1000;

/** Restarts an idempotent privacy workflow after a recoverable terminal state. */
export const retryCleanupWorkflowProgram = Effect.fn(
  "privacy.retryCleanupWorkflow"
)(function* (workflowId: WorkflowId, source: CleanupSource) {
  const ctx = yield* MutationCtxService;
  yield* Effect.gen(function* () {
    const status = yield* tryPrivacyCleanup(() =>
      workflow.status(ctx, workflowId)
    );
    if (status.type !== "failed" && status.type !== "canceled") {
      return;
    }
    yield* tryPrivacyCleanup(() =>
      workflow.restart(ctx, workflowId, {
        from: 0,
        startAsync: true,
      })
    );
  }).pipe(
    Effect.catchTag("PrivacyCleanupError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Privacy cleanup recovery attempt failed").pipe(
          Effect.annotateLogs({
            error: error.message,
            source,
            workflowId,
          })
        );
        const scheduler = yield* Scheduler;
        yield* scheduler
          .runAfter(
            Duration.millis(WORKFLOW_RECOVERY_DELAY_MS),
            refs.internal.privacy.recovery.retryCleanupWorkflow,
            {
              source,
              workflowId,
            }
          )
          .pipe(Effect.catchDefect(flow(toPrivacyCleanupError, Effect.fail)));
      })
    )
  );
});

/** Releases a successful workflow journal, retaining it when the SDK is unavailable. */
export const cleanupWorkflowStorageProgram = Effect.fn(
  "privacy.cleanupWorkflowStorage"
)(function* (workflowId: WorkflowId, source: CleanupSource) {
  const ctx = yield* MutationCtxService;
  yield* tryPrivacyCleanup(() => workflow.cleanup(ctx, workflowId)).pipe(
    Effect.catchTag("PrivacyCleanupError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Privacy workflow journal cleanup failed").pipe(
          Effect.annotateLogs({
            error: error.message,
            source,
            workflowId,
          })
        );
        const scheduler = yield* Scheduler;
        yield* scheduler
          .runAfter(
            Duration.millis(WORKFLOW_RECOVERY_DELAY_MS),
            refs.internal.privacy.recovery.cleanupWorkflowStorage,
            {
              source,
              workflowId,
            }
          )
          .pipe(Effect.catchDefect(flow(toPrivacyCleanupError, Effect.fail)));
      })
    )
  );
});
