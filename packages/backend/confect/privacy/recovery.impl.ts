import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { handleCleanupComplete as completedWorkflow } from "@repo/backend/confect/privacy/completion";
import {
  cleanupWorkflowStorageProgram,
  retryCleanupWorkflowProgram,
} from "@repo/backend/confect/privacy/recovery";
import spec from "@repo/backend/confect/privacy/recovery.spec";
import { Effect, Layer } from "effect";

const retryCleanupWorkflow = FunctionImpl.make(
  databaseSchema,
  spec,
  "retryCleanupWorkflow",
  Effect.fn("privacy.recovery.retryCleanupWorkflow")(function* (args) {
    const ctx = yield* MutationCtxService;
    yield* retryCleanupWorkflowProgram(ctx, args.workflowId, args.source);
    return null;
  })
);
const handleCleanupComplete = FunctionImpl.make(
  databaseSchema,
  spec,
  "handleCleanupComplete",
  completedWorkflow
);
const cleanupWorkflowStorage = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupWorkflowStorage",
  Effect.fn("privacy.recovery.cleanupWorkflowStorage")(function* (args) {
    const ctx = yield* MutationCtxService;
    yield* cleanupWorkflowStorageProgram(ctx, args.workflowId, args.source);
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(retryCleanupWorkflow),
  Layer.provide(handleCleanupComplete),
  Layer.provide(cleanupWorkflowStorage),
  Layer.provide(atomic),
  GroupImpl.finalize
);
