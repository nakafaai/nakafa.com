import { Ref } from "@confect/core";
import type { CallbackOptions } from "@convex-dev/workflow";

type WorkflowCallback<Context> = Extract<
  CallbackOptions<Context>,
  { context: Context }
>["onComplete"];

/**
 * Converts a Confect plain-function ref for the Workflow component callback slot.
 *
 * Confect registers plain Convex functions in the spec tree, while the Workflow
 * component still accepts native Convex function references for callbacks.
 *
 * @see https://confect.dev/server/plain-convex-functions
 * @see https://www.convex.dev/components/workflow
 */
export const toWorkflowCallbackReference = <Context>(
  ref: Ref.AnyInternal & Ref.AnyMutation,
  _context: Context
): WorkflowCallback<Context> => Ref.getFunctionReference(ref);
