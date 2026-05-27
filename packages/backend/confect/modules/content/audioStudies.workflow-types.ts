import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { RegisteredMutation } from "convex/server";

export type GenerateAudioForQueueItemWorkflow = RegisteredMutation<
  "internal",
  {
    readonly queueItemId: Id<"audioGenerationQueue">;
  },
  null
>;

export type HandleAudioWorkflowComplete = RegisteredMutation<
  "internal",
  {
    readonly context: {
      readonly queueItemId: Id<"audioGenerationQueue">;
    };
    readonly result: {
      readonly kind: string;
    };
    readonly workflowId: string;
  },
  null
>;
