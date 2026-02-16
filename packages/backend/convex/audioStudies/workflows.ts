import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getErrorMessage } from "@repo/backend/convex/utils/helper";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Generates audio for a queue item. Idempotent steps, survives crashes.
 */
export const generateAudioForQueueItem = workflow.define({
  args: {
    queueItemId: vv.id("audioGenerationQueue"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    // Step 1: Atomically lock queue item (pending -> processing)
    const queueItem = await step.runMutation(
      internal.audioStudies.mutations.lockQueueItem,
      {
        queueItemId: args.queueItemId,
      }
    );

    // If item is no longer pending (another worker got it), exit early
    if (!queueItem) {
      return null;
    }

    // Step 2: Fetch content hash for cost protection
    // Uses discriminated contentRef for type-safe lookup
    const contentHash = await step.runQuery(
      internal.audioStudies.queries.getContentHash,
      {
        contentRef: queueItem.contentRef,
      }
    );

    // If content doesn't exist, mark as failed and exit
    if (!contentHash) {
      await step.runMutation(internal.audioStudies.mutations.markQueueFailed, {
        queueItemId: args.queueItemId,
        error: "Content not found",
      });
      return null;
    }

    // Step 3: Get or create audio record (idempotent)
    // Pass discriminated contentRef for type-safe storage
    const audioRecordId = await step.runMutation(
      internal.audioStudies.mutations.createOrGetAudioRecord,
      {
        contentRef: queueItem.contentRef,
        locale: queueItem.locale,
        contentHash,
      }
    );

    // Step 4: Generate script (idempotent - skips if already exists)
    // Exponential backoff retries: 1s, 2s, 4s, 8s, 16s for transient failures (rate limits, etc.)
    await step.runAction(
      internal.audioStudies.actions.generateScript,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    // Step 5: Generate speech (idempotent - skips if already exists)
    // This is the expensive step (ElevenLabs API), so we verify hash before calling
    // Exponential backoff retries: 1s, 2s, 4s, 8s, 16s for transient failures
    await step.runAction(
      internal.audioStudies.actions.generateSpeech,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    // Note: Queue item completion is handled by handleWorkflowComplete
    // This ensures proper state management for success/failure/cancellation cases
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
    context: v.object({ queueItemId: vv.id("audioGenerationQueue") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      await ctx.runMutation(
        internal.audioStudies.mutations.markQueueCompleted,
        {
          queueItemId: args.context.queueItemId,
        }
      );
    } else if (args.result.kind === "failed") {
      const errorMessage = getErrorMessage(args.result.error);

      await ctx.runMutation(internal.audioStudies.mutations.markQueueFailed, {
        queueItemId: args.context.queueItemId,
        error: errorMessage,
      });
    }
    // Canceled: resetStuckQueueItems cron will requeue these

    return null;
  },
});
