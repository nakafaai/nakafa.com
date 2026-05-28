import type { WorkflowArgs, WorkflowId } from "@convex-dev/workflow";
import { vWorkflowId } from "@convex-dev/workflow";
import { type RunResult, vResultValidator } from "@convex-dev/workpool";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { RegisteredMutation } from "convex/server";
import { type Value, v } from "convex/values";

/**
 * Workflow component validator for one queued audio generation job.
 *
 * @see https://confect.dev/server/plain-convex-functions
 * @see https://www.convex.dev/components/workflow
 */
export const generateAudioForQueueItemArgs = {
  queueItemId: v.id("audioGenerationQueue"),
};

/** Workflow completion callback args required by the Convex Workflow component. */
export const handleWorkflowCompleteArgs = {
  context: v.object({ queueItemId: v.id("audioGenerationQueue") }),
  result: vResultValidator,
  workflowId: vWorkflowId,
};

/** Native Workflow mutation type consumed by the Confect plain-function spec. */
export type GenerateAudioForQueueItemWorkflow = RegisteredMutation<
  "internal",
  WorkflowArgs<typeof generateAudioForQueueItemArgs>,
  WorkflowId
>;

interface AudioWorkflowCompleteArgs extends Record<string, Value> {
  context: { queueItemId: Id<"audioGenerationQueue"> };
  result: RunResult;
  workflowId: WorkflowId;
}

/** Native Workflow callback type consumed by the Confect plain-function spec. */
export type HandleAudioWorkflowComplete = RegisteredMutation<
  "internal",
  AudioWorkflowCompleteArgs,
  null
>;
