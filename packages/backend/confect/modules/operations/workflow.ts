import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";

/** Convex Workflow component manager used by documented native adapters. */
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 20,
  },
});
