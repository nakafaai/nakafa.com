import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/**
 * Generates audio for a queue item. Idempotent steps, survives crashes.
 */
export const generateAudioForQueueItem = workflow.define({
  args: {
    queueItemId: v.id("audioGenerationQueue"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await Effect.runPromise(
      Effect.logInfo("Audio workflow started", {
        queueItemId: args.queueItemId,
      })
    );

    // Step 1: Atomically lock queue item (pending -> processing)
    const queueItem = await step.runMutation(
      internal.audioStudies.mutations.queue.lockQueueItem,
      {
        queueItemId: args.queueItemId,
      }
    );

    // If item is no longer pending (another worker got it), exit early
    if (!queueItem) {
      await Effect.runPromise(
        Effect.logInfo("Queue item already locked or invalid", {
          queueItemId: args.queueItemId,
        })
      );
      return null;
    }

    await Effect.runPromise(
      Effect.logInfo("Queue item locked", {
        queueItemId: args.queueItemId,
        contentType: queueItem.contentRef.type,
        contentId: queueItem.contentRef.id,
        locale: queueItem.locale,
      })
    );

    // Step 2: Fetch content hash for cost protection
    const contentHash = await step.runQuery(
      internal.audioStudies.queries.internalFunctions.getContentHash,
      {
        contentRef: queueItem.contentRef,
      }
    );

    // If content doesn't exist, mark as failed and exit
    if (!contentHash) {
      await Effect.runPromise(
        Effect.logWarning("Content not found for queue item", {
          queueItemId: args.queueItemId,
          contentType: queueItem.contentRef.type,
          contentId: queueItem.contentRef.id,
        })
      );
      await step.runMutation(
        internal.audioStudies.mutations.queue.markQueueFailed,
        {
          queueItemId: args.queueItemId,
          error: "Content not found",
        }
      );
      return null;
    }

    // Step 3: Get or create audio record (idempotent)
    const audioRecordId = await step.runMutation(
      internal.audioStudies.mutations.contentAudios.createOrGetAudioRecord,
      {
        contentRef: queueItem.contentRef,
        locale: queueItem.locale,
        contentHash,
      }
    );

    await Effect.runPromise(
      Effect.logInfo("Audio record ready", {
        queueItemId: args.queueItemId,
        audioRecordId,
      })
    );

    // Step 4: Generate script (idempotent - skips if already exists)
    await step.runAction(
      internal.node.audioStudies.actions.generateScript,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    await Effect.runPromise(
      Effect.logInfo("Script generation completed", {
        queueItemId: args.queueItemId,
        audioRecordId,
      })
    );

    // Step 5: Generate speech (idempotent - skips if already exists)
    await step.runAction(
      internal.node.audioStudies.actions.generateSpeech,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    await Effect.runPromise(
      Effect.logInfo("Speech generation completed", {
        queueItemId: args.queueItemId,
        audioRecordId,
      })
    );

    return null;
  },
});

/**
 * Handles workflow completion (success, failure, cancellation).
 */
export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ queueItemId: v.id("audioGenerationQueue") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      await Effect.runPromise(
        Effect.logInfo("Audio workflow completed successfully", {
          queueItemId: args.context.queueItemId,
          workflowId: args.workflowId,
        })
      );

      const item = await ctx.db.get(args.context.queueItemId);
      if (item && item.status !== "completed") {
        const now = await Effect.runPromise(Clock.currentTimeMillis);
        await ctx.db.patch(args.context.queueItemId, {
          status: "completed",
          completedAt: now,
          updatedAt: now,
        });
      }
    } else if (args.result.kind === "failed") {
      const errorMessage = String(args.result.error);
      await Effect.runPromise(
        Effect.logError("Audio workflow failed", {
          queueItemId: args.context.queueItemId,
          workflowId: args.workflowId,
          error: errorMessage,
        })
      );

      const item = await ctx.db.get(args.context.queueItemId);
      if (item && item.status !== "completed" && item.status !== "failed") {
        const now = await Effect.runPromise(Clock.currentTimeMillis);
        const retryCount = item.retryCount + 1;
        if (retryCount >= item.maxRetries) {
          await ctx.db.patch(args.context.queueItemId, {
            status: "failed",
            errorMessage: `Max retries exceeded (${item.maxRetries}): ${errorMessage}`,
            lastErrorAt: now,
            retryCount,
            updatedAt: now,
          });
        } else {
          await ctx.db.patch(args.context.queueItemId, {
            status: "pending",
            errorMessage,
            lastErrorAt: now,
            retryCount,
            updatedAt: now,
          });
        }
      }
    } else if (args.result.kind === "canceled") {
      await Effect.runPromise(
        Effect.logInfo("Audio workflow canceled", {
          queueItemId: args.context.queueItemId,
          workflowId: args.workflowId,
        })
      );
    }

    return null;
  },
});
