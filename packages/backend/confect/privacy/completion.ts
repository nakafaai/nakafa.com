import { SchemaToValidator } from "@confect/core";
import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { internalMutation } from "@repo/backend/confect/functions";
import { WORKFLOW_RECOVERY_DELAY_MS } from "@repo/backend/confect/privacy/recovery";
import {
  cleanupSourceValidator,
  PrivacyCleanupError,
  toPrivacyCleanupError,
} from "@repo/backend/confect/privacy/spec";
import { v } from "convex/values";
import { Duration, Effect, Scheduler as EffectScheduler, flow } from "effect";
/** Retains incomplete privacy journals and releases successful ones. */
export const handleCleanupComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({
      source: SchemaToValidator.compileSchema(cleanupSourceValidator),
    }),
  },
  returns: v.null(),
  handler: (ctx, args): Promise<null> =>
    Effect.gen(function* () {
      const scheduler = yield* Scheduler;
      if (args.result.kind === "success") {
        yield* scheduler.runAfter(
          Duration.zero,
          refs.internal.privacy.recovery.cleanupWorkflowStorage,
          {
            source: args.context.source,
            workflowId: args.workflowId,
          }
        );
        return null;
      }
      yield* Effect.logError("Privacy cleanup workflow requires recovery").pipe(
        Effect.annotateLogs({
          resultKind: args.result.kind,
          source: args.context.source,
          workflowId: args.workflowId,
        })
      );
      yield* scheduler
        .runAfter(
          Duration.millis(WORKFLOW_RECOVERY_DELAY_MS),
          refs.internal.privacy.recovery.retryCleanupWorkflow,
          {
            source: args.context.source,
            workflowId: args.workflowId,
          }
        )
        .pipe(Effect.catchDefect(flow(toPrivacyCleanupError, Effect.fail)));
      return null;
    }).pipe(
      Effect.provide(
        RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
      ),
      RegisteredFunction.runHandlerPromise(PrivacyCleanupError, {
        scheduler: new EffectScheduler.MixedScheduler("sync"),
      })
    ),
});
