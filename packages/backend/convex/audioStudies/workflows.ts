import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getErrorMessage } from "@repo/backend/convex/utils/helper";
import { logger } from "@repo/backend/convex/utils/logger";
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
    logger.info("Audio workflow started", { queueItemId: args.queueItemId });

    // Step 1: Atomically lock queue item (pending -> processing)
    const queueItem = await step.runMutation(
      internal.audioStudies.mutations.lockQueueItem,
      {
        queueItemId: args.queueItemId,
      }
    );

    // If item is no longer pending (another worker got it), exit early
    if (!queueItem) {
      logger.info("Queue item already locked or invalid", {
        queueItemId: args.queueItemId,
      });
      return null;
    }

    logger.info("Queue item locked", {
      queueItemId: args.queueItemId,
      contentType: queueItem.contentRef.type,
      contentId: queueItem.contentRef.id,
      locale: queueItem.locale,
    });

    // Step 2: Fetch content hash for cost protection
    const contentHash = await step.runQuery(
      internal.audioStudies.queries.getContentHash,
      {
        contentRef: queueItem.contentRef,
      }
    );

    // If content doesn't exist, mark as failed and exit
    if (!contentHash) {
      logger.warn("Content not found for queue item", {
        queueItemId: args.queueItemId,
        contentType: queueItem.contentRef.type,
        contentId: queueItem.contentRef.id,
      });
      await step.runMutation(internal.audioStudies.mutations.markQueueFailed, {
        queueItemId: args.queueItemId,
        error: "Content not found",
      });
      return null;
    }

    // Step 3: Get or create audio record (idempotent)
    const audioRecordId = await step.runMutation(
      internal.audioStudies.mutations.createOrGetAudioRecord,
      {
        contentRef: queueItem.contentRef,
        locale: queueItem.locale,
        contentHash,
      }
    );

    logger.info("Audio record ready", {
      queueItemId: args.queueItemId,
      audioRecordId,
    });

    // Step 4: Generate script (idempotent - skips if already exists)
    await step.runAction(
      internal.audioStudies.actions.generateScript,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    logger.info("Script generation completed", {
      queueItemId: args.queueItemId,
      audioRecordId,
    });

    // Step 5: Generate speech (idempotent - skips if already exists)
    await step.runAction(
      internal.audioStudies.actions.generateSpeech,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    logger.info("Speech generation completed", {
      queueItemId: args.queueItemId,
      audioRecordId,
    });

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
      logger.info("Audio workflow completed successfully", {
        queueItemId: args.context.queueItemId,
        workflowId: args.workflowId,
      });
      await ctx.runMutation(
        internal.audioStudies.mutations.markQueueCompleted,
        {
          queueItemId: args.context.queueItemId,
        }
      );
    } else if (args.result.kind === "failed") {
      const errorMessage = getErrorMessage(args.result.error);
      logger.error(
        "Audio workflow failed",
        {
          queueItemId: args.context.queueItemId,
          workflowId: args.workflowId,
        },
        args.result.error
      );

      await ctx.runMutation(internal.audioStudies.mutations.markQueueFailed, {
        queueItemId: args.context.queueItemId,
        error: errorMessage,
      });
    } else if (args.result.kind === "canceled") {
      logger.info("Audio workflow canceled", {
        queueItemId: args.context.queueItemId,
        workflowId: args.workflowId,
      });
    }

    return null;
  },
});
