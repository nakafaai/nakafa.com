import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getErrorMessage } from "@repo/backend/convex/utils/helper";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Single end-to-end workflow for audio generation.
 *
 * This workflow orchestrates the complete pipeline:
 * 1. Lock queue item (atomically fetch and mark processing)
 * 2. Fetch content hash for cost protection
 * 3. Create or get existing audio record with content hash (idempotent)
 * 4. Generate script using AI (idempotent - skips if exists)
 * 5. Generate speech using ElevenLabs (idempotent - skips if exists)
 * 6. Mark queue item as completed
 *
 * Benefits:
 * - Survives server restarts and crashes
 * - Automatic retries on transient failures
 * - Idempotent steps prevent double-work and double-cost
 * - Content hash validation prevents wasted API calls
 * - Each queue item processed independently for parallelism
 * - Errors handled by onComplete handler (no manual try-catch needed)
 *
 * Type Safety:
 * - Uses discriminated contentRef throughout
 * - TypeScript narrows types automatically
 * - No type assertions needed
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
    // Automatic retries enabled for transient failures (rate limits, etc.)
    await step.runAction(
      internal.audioStudies.actions.generateScript,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: true,
      }
    );

    // Step 5: Generate speech (idempotent - skips if already exists)
    // This is the expensive step (ElevenLabs API), so we verify hash before calling
    // Automatic retries enabled for transient failures
    await step.runAction(
      internal.audioStudies.actions.generateSpeech,
      {
        contentAudioId: audioRecordId,
      },
      {
        retry: true,
      }
    );

    // Step 6: Mark queue item as completed
    await step.runMutation(internal.audioStudies.mutations.markQueueCompleted, {
      queueItemId: args.queueItemId,
    });

    return null;
  },
});

/**
 * Handle workflow completion - success, error, or cancellation.
 * This is called automatically when the workflow finishes.
 *
 * Note: We don't use try-catch in the workflow itself. Instead, we let
 * errors bubble up naturally and handle cleanup here. This is the Convex
 * best practice for durable workflows.
 */
export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ queueItemId: vv.id("audioGenerationQueue") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "failed") {
      // Workflow failed - mark queue item as failed
      // Use getErrorMessage to properly extract error details
      const errorMessage = getErrorMessage(args.result.error);

      await ctx.runMutation(internal.audioStudies.mutations.markQueueFailed, {
        queueItemId: args.context.queueItemId,
        error: errorMessage,
      });
    }
    // Success case: queue item already marked completed by the workflow
    // Canceled case: workflow was manually canceled, leave queue item as-is

    return null;
  },
});
