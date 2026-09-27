import { FunctionSpec, GroupSpec } from "@confect/core";
import type { WorkflowId } from "@convex-dev/workflow";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import type { handleCleanupComplete } from "@repo/backend/confect/privacy/completion";
import {
  cleanupSourceValidator,
  PrivacyCleanupErrorWire,
} from "@repo/backend/confect/privacy/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "retryCleanupWorkflow",
      args: () => ({
        source: cleanupSourceValidator,
        workflowId: Schema.Opaque<WorkflowId>()(Schema.String),
      }),
      returns: () => Schema.Null,
      error: () => PrivacyCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof handleCleanupComplete>()(
      "handleCleanupComplete"
    )
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupWorkflowStorage",
      args: () => ({
        source: cleanupSourceValidator,
        workflowId: Schema.Opaque<WorkflowId>()(Schema.String),
      }),
      returns: () => Schema.Null,
      error: () => PrivacyCleanupErrorWire,
    }).middleware(Atomic)
  );
