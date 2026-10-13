import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { internalMutation } from "@repo/backend/confect/functions";
import { workflow } from "@repo/backend/confect/workflow";
import { v } from "convex/values";
import { Effect, Scheduler as EffectScheduler } from "effect";

/**
 * Releases the journal of an invitation workflow that delivered. One that did
 * not deliver keeps its journal and is logged, so it can be read and
 * restarted.
 */
export const finishInviteEmail = internalMutation({
  args: {
    context: v.object({ inviteId: v.id("tenantInvites") }),
    result: vResultValidator,
    workflowId: vWorkflowId,
  },
  returns: v.null(),
  handler: (ctx, args): Promise<null> =>
    Effect.gen(function* () {
      if (args.result.kind !== "success") {
        yield* Effect.logError("An invitation email was not delivered").pipe(
          Effect.annotateLogs({
            inviteId: args.context.inviteId,
            resultKind: args.result.kind,
            workflowId: args.workflowId,
          })
        );
        return null;
      }
      yield* Effect.promise(() => workflow.cleanup(ctx, args.workflowId));
      return null;
    }).pipe(
      Effect.provide(
        RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
      ),
      RegisteredFunction.runHandlerPromise(undefined, {
        scheduler: new EffectScheduler.MixedScheduler("sync"),
      })
    ),
});
