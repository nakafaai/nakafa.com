import type { WorkflowId } from "@convex-dev/workflow";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { workflow } from "@repo/backend/confect/workflow";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Removes one terminal proof coordinator or fails without losing its identity. */
export const cleanupProofWorkflow = Effect.fn(
  "contentRelease.cleanupProofWorkflow"
)(function* (ctx: MutationCtx, workflowId: WorkflowId) {
  const cleaned = yield* Effect.promise(() =>
    workflow.cleanup(ctx, workflowId)
  );
  if (!cleaned) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Proof workflow ${workflowId} could not be cleaned.`
    );
  }
});

/** Cancels one active proof coordinator before removing its durable state. */
export const stopProofWorkflow = Effect.fn("contentRelease.stopProofWorkflow")(
  function* (ctx: MutationCtx, workflowId: WorkflowId) {
    const status = yield* Effect.promise(() =>
      workflow.status(ctx, workflowId)
    );
    if (status.type === "inProgress") {
      yield* Effect.promise(() => workflow.cancel(ctx, workflowId));
    }
    yield* cleanupProofWorkflow(ctx, workflowId);
  }
);
