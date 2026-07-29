import type { WorkflowId } from "@convex-dev/workflow";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { workflow } from "@repo/backend/convex/workflow";
import { Effect } from "effect";

/** Removes one terminal proof coordinator or fails without losing its identity. */
export const cleanupProofWorkflow = Effect.fn(
  "contentRelease.cleanupProofWorkflow"
)(function* (ctx: MutationCtx, workflowId: WorkflowId) {
  const cleaned = yield* callInternal(() => workflow.cleanup(ctx, workflowId));
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
    const status = yield* callInternal(() => workflow.status(ctx, workflowId));
    if (status.type === "inProgress") {
      yield* callInternal(() => workflow.cancel(ctx, workflowId));
    }
    yield* cleanupProofWorkflow(ctx, workflowId);
  }
);
