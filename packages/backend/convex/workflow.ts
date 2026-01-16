import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "@repo/backend/convex/_generated/api";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 20,
  },
});
