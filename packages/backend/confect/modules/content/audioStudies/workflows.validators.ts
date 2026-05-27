import type { WorkflowArgs, WorkflowId } from "@convex-dev/workflow";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import type { RegisteredMutation } from "convex/server";
import { type ObjectType, v } from "convex/values";

export const generateAudioForQueueItemWorkflowArgs = {
  queueItemId: v.id("audioGenerationQueue"),
};

export const generateAudioForQueueItemWorkflowReturns = v.null();

export const handleWorkflowCompleteArgs = {
  context: v.object({ queueItemId: v.id("audioGenerationQueue") }),
  result: vResultValidator,
  workflowId: vWorkflowId,
};

export const handleWorkflowCompleteReturns = v.null();

export type GenerateAudioForQueueItemWorkflow = RegisteredMutation<
  "internal",
  WorkflowArgs<typeof generateAudioForQueueItemWorkflowArgs>,
  WorkflowId
>;

export type HandleAudioWorkflowComplete = RegisteredMutation<
  "internal",
  ObjectType<typeof handleWorkflowCompleteArgs>,
  null
>;
