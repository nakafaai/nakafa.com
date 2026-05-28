import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "@repo/backend/convex/_generated/api";

/** Convex Workflow component manager used by documented native adapters. */
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 20,
  },
});
