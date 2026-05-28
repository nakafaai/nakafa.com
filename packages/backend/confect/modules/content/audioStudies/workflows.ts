import refs from "@repo/backend/confect/_generated/refs";
import {
  generateAudioForQueueItemArgs,
  handleWorkflowCompleteArgs,
} from "@repo/backend/confect/modules/content/audioStudies/contracts";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Generates audio for a queue item with idempotent workflow steps.
 */
export const generateAudioForQueueItem = workflow.define({
  args: generateAudioForQueueItemArgs,
  returns: v.null(),
  handler: async (step, args) => {
    await Effect.runPromise(
      Effect.logInfo("Audio workflow started", {
        queueItemId: args.queueItemId,
      })
    );

    const queueItem = await step.runMutation(
      toConvexReference(
        refs.internal.audioStudies.mutations.queue.lockQueueItem
      ),
      {
        queueItemId: args.queueItemId,
      }
    );
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

    const contentHash = await step.runQuery(
      toConvexReference(
        refs.internal.audioStudies.queries.internalFunctions.getContentHash
      ),
      {
        contentRef: queueItem.contentRef,
      }
    );
    if (!contentHash) {
      await Effect.runPromise(
        Effect.logWarning("Content not found for queue item", {
          queueItemId: args.queueItemId,
          contentType: queueItem.contentRef.type,
          contentId: queueItem.contentRef.id,
        })
      );
      await step.runMutation(
        toConvexReference(
          refs.internal.audioStudies.mutations.queue.markQueueFailed
        ),
        {
          queueItemId: args.queueItemId,
          error: "Content not found",
        }
      );
      return null;
    }

    const audioRecordId = await step.runMutation(
      toConvexReference(
        refs.internal.audioStudies.mutations.contentAudios
          .createOrGetAudioRecord
      ),
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

    await step.runAction(
      toConvexReference(refs.internal.node.audioStudies.actions.generateScript),
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

    await step.runAction(
      toConvexReference(refs.internal.node.audioStudies.actions.generateSpeech),
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
 * Handles terminal audio workflow states and repairs queue status.
 */
export const handleWorkflowComplete = internalMutation({
  args: handleWorkflowCompleteArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      await Effect.runPromise(
        Effect.logInfo("Audio workflow completed successfully", {
          queueItemId: args.context.queueItemId,
          workflowId: args.workflowId,
        })
      );
      await ctx.runMutation(
        toConvexReference(
          refs.internal.audioStudies.mutations.queue.markQueueCompleted
        ),
        { queueItemId: args.context.queueItemId }
      );
      return null;
    }

    if (args.result.kind === "failed") {
      const errorMessage = String(args.result.error);
      await Effect.runPromise(
        Effect.logError("Audio workflow failed", {
          queueItemId: args.context.queueItemId,
          workflowId: args.workflowId,
          error: errorMessage,
        })
      );

      await ctx.runMutation(
        toConvexReference(
          refs.internal.audioStudies.mutations.queue.markQueueFailed
        ),
        {
          queueItemId: args.context.queueItemId,
          error: errorMessage,
        }
      );
      return null;
    }

    if (args.result.kind === "canceled") {
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
